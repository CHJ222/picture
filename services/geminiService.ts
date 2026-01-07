
import { GoogleGenAI, Type } from "@google/genai";
import COS from "https://esm.sh/cos-js-sdk-v5";

const API_BASE = "https://pinstyle-test.imagiclamp.cn/api";

const uploadToTencentCOS = async (imageBlob: Blob): Promise<string> => {
  const currentOrigin = window.location.origin;
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
      if (err) reject(new Error("上传图片到云端失败，请检查跨域设置"));
      else resolve(`https://${bucket}.cos.${Region}.myqcloud.com/${fileName}`);
    });
  });
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

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

export const createMagicStoryBook = async (heroBlob: Blob, storyBlob: Blob, preCapturedFace?: Blob): Promise<any> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key 未配置");
  const ai = new GoogleGenAI({ apiKey });
  
  // 1. 准备主角正脸参考图
  const heroImageBlob = preCapturedFace || await extractFrameAsBlob(heroBlob);

  // 2. 并行处理：转码视频 + 上传参考图
  const [heroBase64, storyBase64, heroReferenceUrl] = await Promise.all([
    blobToBase64(heroBlob),
    blobToBase64(storyBlob),
    uploadToTencentCOS(heroImageBlob)
  ]);

  // 获取真实的 MIME 类型，确保 Gemini 能正确解析视频
  const heroMimeType = heroBlob.type.split(';')[0] || 'video/webm';
  const storyMimeType = storyBlob.type.split(';')[0] || 'video/webm';

  // 3. 定义 Gemini 3 的系统指令 (强化主角特征提取 + 漫画风格)
  const systemInstruction = `你是一位世界级的儿童绘本大师。
任务：根据 'story_video' (故事讲述) 和 'hero_video' (主角视频)，创作一个 3 页的精彩漫画风格绘本。

**核心任务：确保主角相似度 (Character Consistency)**
1. **视觉分析**：首先，仔细观察 'hero_video' 中的小朋友。提取所有关键视觉特征：
   - 种族/肤色 (Ethnicity/Skin tone)
   - 发型与发色 (Hair style & color)
   - 服装细节 (Clothing color & type)
   - 面部特征 (Face shape, glasses, etc.)
   - 生成一个 **精确的英文人物描述 (Character Prompt)**，例如: "a cute 5-year-old Chinese boy with short black hair and round glasses, wearing a yellow hoodie".

2. **提示词构建规则**：
   - 每个场景的 \`imagePrompt\` **必须** 包含上述的 **Character Prompt**。
   - 结构：\`[Character Prompt], [Action], [Environment], [Style Tags]\`
   - 风格标签 (Style Tags)："(Comic book style:1.5), (Identity preservation:1.2), vibrant colors, bold outlines, cel shading, clean lines, expressive, dynamic composition, flat color, graphic novel style, high quality, 8k."

**输出 JSON 格式要求**：
- title: 绘本标题 (中文)
- characterDescription: (英文) 你提取的主角视觉特征描述。
- scenes: 数组 (3个对象)
  - pageNumber: 页码
  - narration: (中文) 故事旁白。
  - imagePrompt: (英文) 完整的生图提示词 (必须包含 characterDescription 的内容，不要用代词)。
`;

  // 4. 调用 Gemini 3 Pro 生成故事脚本
  const textResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [
      {
        parts: [
          { inlineData: { data: heroBase64, mimeType: heroMimeType } },
          { inlineData: { data: storyBase64, mimeType: storyMimeType } },
          { text: "请分析视频中的主角样貌，并根据故事内容创作绘本脚本。请确保 imagePrompt 里详细描述了主角的样子，以便生成的图片和视频里的人像。" }
        ]
      }
    ],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          characterDescription: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pageNumber: { type: Type.NUMBER },
                narration: { type: Type.STRING },
                imagePrompt: { type: Type.STRING }
              },
              required: ["pageNumber", "narration", "imagePrompt"]
            }
          }
        },
        required: ["title", "characterDescription", "scenes"]
      }
    }
  });

  const storyData = JSON.parse(textResponse.text);
  
  // 5. 调用生图接口
  await Promise.all(storyData.scenes.map(async (scene: any) => {
    try {
      scene.imageUrl = await generateImageViaCustomAPI(scene.imagePrompt, heroReferenceUrl);
    } catch (err) {
      console.error("生图失败:", err);
      scene.imageUrl = `https://picsum.photos/800/800?random=${scene.pageNumber}`;
    }
  }));

  return storyData;
};

const generateImageViaCustomAPI = async (prompt: string, referenceImageUrl: string): Promise<string> => {
  // 调用自定义 API
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
  // 轮询等待结果
  for (let i = 0; i < 20; i++) { 
    await new Promise(r => setTimeout(r, 3000));
    const queryResponse = await fetch(`${API_BASE}/produces/image/${taskId}`);
    const queryResult = await queryResponse.json();
    if (queryResult.code === 200 && queryResult.data && queryResult.data.picStatus === "5") {
      return queryResult.data.picUrl;
    }
  }
  throw new Error("生图超时，请稍后再试");
};
