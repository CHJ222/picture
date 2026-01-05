
import { GoogleGenAI, Type } from "@google/genai";

/**
 * 将 Blob 转换为 Base64 字符串
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * 核心逻辑：分析双视频并生成水彩风格绘本
 */
export const createMagicStoryBook = async (heroBlob: Blob, storyBlob: Blob): Promise<any> => {
  // 安全检查：确保 API Key 已通过 vite.config.ts 注入
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("魔法钥匙丢失了！(请在 Vercel 环境变量中配置 API_KEY)");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const heroBase64 = await blobToBase64(heroBlob);
  const storyBase64 = await blobToBase64(storyBlob);

  const systemInstruction = `你是一位世界级的儿童绘本主编和视觉导演。
任务：根据两个视频输入创作一个5页的魔法绘本。

**输入分析**：
1. 'hero_video': 主角视频。**核心任务：建立“视觉指纹”**。
   - 请仔细观察主角的：年龄、性别、种族、发型(颜色/长短/卷直)、是否戴眼镜(重要特征)、服装细节(颜色/图案/款式)。
   - **必须**提取这些特征，形成一个高度精确的英文描述标签(Prompt Tags)。
   - 例如: "cute 6-year-old asian girl, double buns black hair, round red glasses, pink hoodie with cat print, blue jeans".
2. 'story_video': 故事讲述。提取核心情节，改编成温馨、富有想象力的童话。

**输出要求 (JSON)**：
- 'character.visualDescription': 上述提取的“视觉指纹”英文标签。
- 'scenes': 5个精彩分镜。
- 'scenes[].narration': 适合儿童阅读的中文故事文本。
- 'scenes[].imagePrompt': **必须严格遵循此格式**: "A masterpiece watercolor illustration of [character.visualDescription] [doing specific action]. [Scene environment details]. Soft lighting, dreamy atmosphere, high quality." 
  (注意：必须将 visualDescription 完整填入每个 Prompt 中，确保主角在每一页都长得一样！)

**风格约束**：
- 艺术风格：Beautiful soft watercolor, hand-painted texture, whimsical, Ghibli-inspired colors.
- 严禁：Photorealistic, 3D render, dark or scary elements.
`;

  // 使用 gemini-2.5-flash 替代 gemini-3-pro-preview 以避免配额限制
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        parts: [
          { inlineData: { data: heroBase64, mimeType: 'video/webm' } },
          { inlineData: { data: storyBase64, mimeType: 'video/webm' } },
          { text: "请开始创作！请确保每一页插画里的主角都和 'hero_video' 里的小朋友长得一模一样！" }
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
          character: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              visualDescription: { type: Type.STRING, description: "从视频提取的精确英文视觉特征标签" }
            },
            required: ["name", "visualDescription"]
          },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pageNumber: { type: Type.NUMBER },
                narration: { type: Type.STRING },
                imagePrompt: { type: Type.STRING, description: "包含主角视觉特征的完整英文绘画提示词" }
              },
              required: ["pageNumber", "narration", "imagePrompt"]
            }
          }
        },
        required: ["title", "character", "scenes"]
      }
    }
  });

  const storyData = JSON.parse(response.text);
  
  // 按照分镜逐一生成水彩插画
  for (let scene of storyData.scenes) {
    // 这里的 imagePrompt 已经包含了 visualDescription，所以直接使用即可
    scene.imageUrl = await generateWatercolorIllustration(scene.imagePrompt);
  }

  return storyData;
};

/**
 * 使用 gemini-2.5-flash-image 生成高度匹配且具有水彩质感的图片
 */
const generateWatercolorIllustration = async (prompt: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return 'https://picsum.photos/600/600?error=no_key';

  const ai = new GoogleGenAI({ apiKey });
  try {
    // 移除多余的后缀，因为现在 System Instruction 已经要求生成完整的 prompt 了
    // 但为了保险，还是保留风格后缀
    const finalPrompt = `${prompt}, masterpiece, best quality, watercolor art style, hand-painted on textured paper, soft edges, whimsical lighting.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: finalPrompt }] }],
      config: { 
        imageConfig: { 
          aspectRatio: "1:1" 
        } 
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error("生成水彩魔法插画失败:", e);
  }
  return 'https://picsum.photos/600/600?random=' + Math.random();
};
