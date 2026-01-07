
import { GoogleGenAI, Type } from "@google/genai";
import COS from "https://esm.sh/cos-js-sdk-v5";

const API_BASE = "https://pinstyle-test.imagiclamp.cn/api";

// --- 辅助函数：上传 COS ---
const uploadToTencentCOS = async (imageBlob: Blob): Promise<string> => {
  // 打印当前域名到控制台，方便用户配置 COS 跨域
  console.log("🌐 当前域名 (Origin) 用于 COS 跨域配置:", window.location.origin);
  
  const authResponse = await fetch(`${API_BASE}/system/cos/v1/getPreSignedUrlForPost`);
  const authResult = await authResponse.json();
  
  if (authResult.code !== 200 || !authResult.data) {
    throw new Error("获取 COS 凭据失败");
  }

  const { tmpSecretId, tmpSecretKey, sessionToken, startTime, expiredTime, bucket, region } = authResult.data;
  const cos = new COS({
    getAuthorization: (options, callback) => {
      callback({
        TmpSecretId: tmpSecretId,
        TmpSecretKey: tmpSecretKey,
        SecurityToken: sessionToken,
        StartTime: startTime,
        ExpiredTime: expiredTime,
      });
    }
  });

  const fileName = `magicMaker/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.jpg`;
  const Region = region || 'ap-nanjing'; 

  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket: bucket, 
      Region: Region,
      Key: fileName,
      Body: imageBlob
    }, (err, data) => {
      if (err) {
        console.error("❌ COS 上传失败，请确认已在腾讯云控制台添加跨域白名单:", window.location.origin);
        reject(new Error("上传图片到云端失败，请检查跨域设置"));
      }
      else resolve(`https://${bucket}.cos.${Region}.myqcloud.com/${fileName}`);
    });
  });
};

// --- 辅助函数：Blob 转 Base64 ---
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- 辅助函数：从视频抽帧 ---
const extractFrameAsBlob = (videoBlob: Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoBlob);
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = () => { video.currentTime = 1.0; };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("抽帧失败"));
        }, 'image/jpeg', 0.8);
      }
      URL.revokeObjectURL(video.src);
    };
    video.onerror = (e) => reject(e);
  });
};

// --- 辅助函数：重试逻辑 ---
async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // 处理 429 (Too Many Requests) 和 503 (Service Unavailable)
    const status = error.status || error.response?.status;
    const message = error.message || '';
    if (retries > 0 && (status === 429 || status === 503 || message.includes('429') || message.includes('quota'))) {
      console.warn(`API Rate Limit hit. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

// --- 核心业务逻辑 ---

interface ExtractedMetadata {
  title: string;
  summary: string;
  charAge: string;
  charGender: string;
  charClothing: string;
}

// 步骤 1: 分析视频内容
const analyzeVideoContent = async (ai: GoogleGenAI, heroBase64: string, heroMime: string, storyBase64: string, storyMime: string): Promise<ExtractedMetadata> => {
  const analysisPrompt = `
  请分析提供的两个视频：
  1. 第一个视频是 'Hero Video' (主角视频)。
  2. 第二个视频是 'Story Video' (故事讲述)。

  请提取以下信息并以 JSON 格式返回：
  - title: 根据故事内容起一个有趣的中文书名。
  - summary: 故事内容的详细中文梗概。
  - charAge: 预估主角的年龄 (例如 "5 years old")。
  - charGender: 主角的性别 (例如 "Boy" 或 "Girl")。
  - charClothing: 主角的服装特征描述 (中文描述，例如 "黄色卫衣")。
  `;

  return retryOperation(async () => {
    const resp = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: [{
        parts: [
          { inlineData: { data: heroBase64, mimeType: heroMime } },
          { inlineData: { data: storyBase64, mimeType: storyMime } },
          { text: analysisPrompt }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            charAge: { type: Type.STRING },
            charGender: { type: Type.STRING },
            charClothing: { type: Type.STRING },
          }
        }
      }
    });
    return JSON.parse(resp.text);
  });
};

// 步骤 2: 构建 Prompt 模板并生成详细提示词
const generatePagePrompts = async (ai: GoogleGenAI, metadata: ExtractedMetadata, heroBase64: string, heroMime: string, storyBase64: string, storyMime: string): Promise<string> => {
  const promptTemplate = `
角色设定：你现在是一位专业的绘本主编兼艺术总监。我需要你协助我策划并编写一本定制绘本或定制漫画书。你需要写出每页的AI绘画提示词（Prompt）。

项目基础信息（请严格遵守）：
书名：${metadata.title}
系列名：魔法绘本系列
内容梗概：${metadata.summary}
出图比例：1:1
人物或物体1的名字：The Protagonist (Kid)
人物或物体1的照片：参考图1 (Hero Video Reference)
人物1的年龄：${metadata.charAge}
人物1的性别：${metadata.charGender}

请根据内容梗概、文案风格，按照3页的篇幅(不包含封面和扉页)，根据人物或物体的数量、名字、人物年龄、及可能的关系，使用相应的人物或者物体的名字，编写每一页的详细内容，每一页画面要有丰富的内容元素，并为我输出每一页的生图提示词内容，每一页提示词之间用################符号分割。不需要开场白，直接从第一页开始输出。每一页的画风必须保持一致，每一页的故事情节和元素形象必须具有连贯性和一致性。

根据视频里面描述的故事内容，和人物或物体的名字，判断每一个名字是不是人物。
在提示词中一定要用中性的人称词，比如The kid, the child, the person，孩子等。禁止出现He、She、Boy、Girl、Man、Woman、他、她、男孩、女孩等人称词。
人物服装特殊要求：${metadata.charClothing}

每一页提示词按照如下格式要求：

输出的内容用全中文：

【Cover】
综合全部信息，编写一个画册封面的生图提示词。
生成一张图片，描述如下：

对于每个参考图：
参考图1：列出人物和物体的名字、人物的年龄。写：“ 保持图片中人物的特征不变，人物的脸型和五官不变，人物的发型不发生任何变化，人物的发色不发生任何变化，同时保证衣服不变。Analyze this reference image. For the character's clothing features, facial features, eyes features and hair style, strictly refer to the Reference Image, and make the character look exactly like the age. For the object or toy's features, strictly refer to the Reference Image.”。
参考图1的补充说明：如果该参考图不是人物，请不要在任何页里描述它的种类、特征、颜色等，严格参考它对应的参考图。

画风：写：“Crayon drawing style, children's book illustration, wax pastel texture, rough edges, vibrant and warm colors, naive art style (蜡笔画风格，儿童绘本插画，油画棒质感)”
图片中写的书名的要求：
* 书名语言是 中文, and 英文。（文案中不要有“Chinese”、“English”、“CN”、“EN”、“中文”、“英文”等文字，文案中禁止出现He、She、Boy、Girl、Man、Woman、他、她、男孩、女孩等带有性别的人称词）。
* 书名：${metadata.title}。
* 书名字体：需要给出建议的字体，书名文字用手写体和漂亮的颜色，文字不要太小，书名文字有美丽的背景图案。
* 书名位置：请指出这一页文字应该放在画面的哪里，确保不压住人物脸部。
最上面用小字写：魔法绘本系列。
最下面用小字写：“编号：[XHS${Math.floor(Math.random() * 1000000)}]”

AI生图提示词要求（ Prompt）：请编写用于生图的中文提示词，要求画面内容元素丰富，不少于300个单词。详细描述该页的画面、构图、动作、场景、光影、人物表情、姿势、物体。

排版与设计建议：画面满幅。写：“Ensure clean composition with anatomically correct body. Avoid extra limbs, extra arms, extra legs, mutated hands, fused fingers. Avoid split screen, avoid character duplication, avoid ghosting, avoid mirrored images.”。面部表情清晰可见。

写：“以上画面是右面半个画面作为封面，而左面半个画面（封底）是右面半个画面的背景的自然延伸。封面和封底自然衔接连成一个整体画面。在封底的右下合适位置画一个半透明背景框，里面用中小号文字写如下信息（先翻译成英文）：
“Written by AI & The Kid, Illustrated by Magic Maker” ”

图片比例：1:1

################

【Title Page】
生成一张扉页的图片，描述如下：

画风：写：“Crayon drawing style, children's book illustration, wax pastel texture, rough edges, vibrant and warm colors, naive art style (蜡笔画风格，儿童绘本插画，油画棒质感)”
AI生图提示词要求（ Prompt）：请编写用于生图的中文提示词，要求画面为与全书内容匹配的简单的背景图。写：“把参考图1的原图，不做任何变化，放到这一页中的合适位置、合适大小，不要居中。参考图1的边框可以用一些小的点缀。”
图片中写的文案的要求：
* 文案语言是 中文, and 英文。（文案中不要有“Chinese”、“English”、“CN”、“EN”、“中文”、“英文”等文字，文案中禁止出现He、She、Boy、Girl、Man、Woman、他、她、男孩、女孩等带有性别的人称词）。
* 扉页文案1：“这是一个关于勇气的故事” (或者根据故事内容生成一句简短的slogan)
* 扉页文案2：“送给最特别的你”
* 文案字体：需要给出建议的字体，用手写体，文字不要太小。
* 文案位置：请指出这一页两组文案应该放在画面的哪里。

排版与设计建议：画面满幅。写：“Ensure clean composition. Avoid split screen, avoid mirrored images.”。

图片比例：1:1

################

【Page 1】
要求：由于每一页的提示词都是独立生图的提示词，所以一定要确保每一页的提示词是完整的、详细的，禁止省略提示词，禁止出现“同上一页”这类的描述。
生成一整张图片，描述如下：

对于每个参考图：
参考图1：列出人物和物体的名字、人物的年龄。写：“ 保持图片中人物的特征不变，人物的脸型和五官不变，人物的发型不发生任何变化，人物的发色不发生任何变化，同时保证衣服不变。Analyze this reference image. For the character's clothing features, facial features, eyes features and hair style, strictly refer to the Reference Image, and make the character look exactly like the age. For the object or toy's features, strictly refer to the Reference Image.”。

画风：写：“Crayon drawing style, children's book illustration, wax pastel texture, rough edges, vibrant and warm colors, naive art style (蜡笔画风格，儿童绘本插画，油画棒质感)”
图片中写的文案的要求：
* 文案语言是 中文, and 英文。（文案中不要有“Chinese”、“English”、“CN”、“EN”、“中文”、“英文”等文字，文案中禁止出现He、She、Boy、Girl、Man、Woman、他、她、男孩、女孩等带有性别的人称词）。文案用简单的口语化的语言。文字中可以出现人物的名字，也可以不出现。
* 中文文案：文案字数不少于20个字或词。
* 英文文案：文案字数不少于20个字或词。
没有编号和系列名。
字体：需要给出建议的字体字号、文字背景，确保每一页文字字体字号背景一致。

AI生图提示词要求（ Prompt）：请编写用于生图的中文提示词，要求画面内容元素丰富，不少于300个单词。详细描述该页的画面、构图、动作、场景、光影、人物表情、姿势、物体。

排版与设计建议：人物不要居中。画面满幅。写：“Ensure clean composition with anatomically correct body. Avoid extra limbs, extra arms, extra legs, mutated hands, fused fingers. Avoid split screen, avoid character duplication, avoid ghosting, avoid mirrored images.”。面部表情清晰可见。

图片比例：1:1

################

【Page 2】
(要求同 Page 1，请根据故事发展编写)

################

【Page 3】
(要求同 Page 1，请根据故事发展编写)

################
`;

  return retryOperation(async () => {
    const resp = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // 替换为 Flash 模型以避免 429 配额错误
      contents: [
        {
          parts: [
            { inlineData: { data: heroBase64, mimeType: heroMime } },
            { inlineData: { data: storyBase64, mimeType: storyMime } },
            { text: promptTemplate }
          ]
        }
      ]
    });
    return resp.text;
  });
};

const parseStoryBlocks = (fullText: string) => {
  const blocks = fullText.split('################').map(b => b.trim()).filter(b => b.length > 0);
  const scenes = [];
  
  const extractNarration = (text: string): string => {
    const cnMatch = text.match(/中文文案[：:]\s*(.*?)(\n|$)/) || text.match(/文案语言1[：:]\s*(.*?)(\n|$)/);
    const enMatch = text.match(/英文文案[：:]\s*(.*?)(\n|$)/) || text.match(/文案语言2[：:]\s*(.*?)(\n|$)/);
    
    let narration = "";
    if (cnMatch) narration += cnMatch[1].trim();
    if (enMatch) narration += "\n" + enMatch[1].trim();
    
    if (!narration) {
      const quotes = text.match(/“([^”]+)”/g);
      if (quotes && quotes.length > 0) {
        narration = quotes.slice(0, 2).join('\n').replace(/[“”]/g, '');
      } else {
        narration = "（AI 正在绘制这页的故事...）";
      }
    }
    return narration;
  };

  let pageIndex = 1;
  for (const block of blocks) {
    if (block.includes(`【Page ${pageIndex}`) || block.includes(`【Page${pageIndex}`)) {
      scenes.push({
        pageNumber: pageIndex,
        narration: extractNarration(block),
        imagePrompt: block 
      });
      pageIndex++;
    }
  }

  if (scenes.length === 0 && blocks.length >= 3) {
    const storyBlocks = blocks.slice(-3);
    storyBlocks.forEach((block, idx) => {
      scenes.push({
        pageNumber: idx + 1,
        narration: extractNarration(block),
        imagePrompt: block
      });
    });
  }

  return scenes;
};

export const createMagicStoryBook = async (heroBlob: Blob, storyBlob: Blob, preCapturedFace?: Blob): Promise<any> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key 未配置");
  const ai = new GoogleGenAI({ apiKey });
  
  const heroImageBlob = preCapturedFace || await extractFrameAsBlob(heroBlob);

  const [heroBase64, storyBase64, heroReferenceUrl] = await Promise.all([
    blobToBase64(heroBlob),
    blobToBase64(storyBlob),
    uploadToTencentCOS(heroImageBlob)
  ]);

  const heroMimeType = heroBlob.type.split(';')[0] || 'video/webm';
  const storyMimeType = storyBlob.type.split(';')[0] || 'video/webm';

  const metadata = await analyzeVideoContent(ai, heroBase64, heroMimeType, storyBase64, storyMimeType);
  const rawPromptText = await generatePagePrompts(ai, metadata, heroBase64, heroMimeType, storyBase64, storyMimeType);
  const scenes = parseStoryBlocks(rawPromptText);

  const storyData = {
    title: metadata.title,
    character: {
      name: "The Kid",
      visualDescription: metadata.charClothing
    },
    scenes: scenes
  };
  
  await Promise.all(storyData.scenes.map(async (scene: any) => {
    try {
      scene.imageUrl = await generateImageViaCustomAPI(scene.imagePrompt, heroReferenceUrl);
    } catch (err) {
      console.error(err);
      scene.imageUrl = `https://picsum.photos/1024/1024?random=${scene.pageNumber}`;
    }
  }));

  return storyData;
};

const generateImageViaCustomAPI = async (prompt: string, referenceImageUrl: string): Promise<string> => {
  const submitResponse = await fetch(`${API_BASE}/produces/image/nanoBanana/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      aiImgTransferText: prompt, 
      size: "1:1",
      imageSize: "1K",
      imageList: [referenceImageUrl] 
    })
  });

  const submitResult = await submitResponse.json();
  if (submitResult.code !== 200) {
    throw new Error(`提交生图任务失败: ${submitResult.msg || '未知错误'}`);
  }

  const taskId = submitResult.data;
  for (let i = 0; i < 30; i++) { 
    await new Promise(r => setTimeout(r, 3000));
    const queryResponse = await fetch(`${API_BASE}/produces/image/${taskId}`);
    const queryResult = await queryResponse.json();
    if (queryResult.code === 200 && queryResult.data && queryResult.data.picStatus === "5") {
      return queryResult.data.picUrl;
    }
  }
  throw new Error("生图超时，请稍后再试");
};
