
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

请根据内容梗概、文案风格，按照3页的篇幅(不包含封面和扉页)，编写每一页的生图提示词内容，每一页提示词之间用################符号分割。

人物服装特殊要求：${metadata.charClothing}
...
`;

  const resp = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
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
