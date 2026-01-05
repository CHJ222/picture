
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

  const systemInstruction = `你是一位顶级儿童水彩绘本艺术家。
你的任务是处理两个视频输入：
1. 'hero_video': 介绍主角。请极其详细地提取主角的视觉特征（例如：圆圆的黑框眼镜、粉色有小猫图案的T恤、扎着两个小辫子的黑色短发等）。这些特征是保证绘本“像他/她自己”的关键。
2. 'story_video': 口述故事。转录并改写为一段优美、简洁、适合4-10岁儿童阅读的童话。

生成一个包含 5 个页面的 JSON 绘本：
- 'character': 包含主角名字和一段极其精炼的视觉特征描述（用于图像生成）。
- 'scenes': 每一页包含 'narration' (讲故事的文字) 和 'imagePrompt' (插画提示词)。

**插画风格规范 (必须遵守)**：
- 风格：Beautiful artistic watercolor painting style, soft brushstrokes, dreamy atmosphere, subtle paper texture.
- 核心要求：每一页的 'imagePrompt' 必须首先包含 'character.visualDescription' 中定义的特征，以确保角色一致性。
- 严禁：不要使用 3D、写实、或者过于鲜艳的矢量图风格。`;

  // 使用 gemini-2.5-flash 替代 gemini-3-pro-preview 以避免配额限制
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        parts: [
          { inlineData: { data: heroBase64, mimeType: 'video/webm' } },
          { inlineData: { data: storyBase64, mimeType: 'video/webm' } },
          { text: "开始施展魔法！请根据视频里的主角和故事，生成一套精美的水彩风分镜绘本。" }
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
              visualDescription: { type: Type.STRING, description: "包含发型、眼镜、服饰细节的英文描述" }
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
                imagePrompt: { type: Type.STRING, description: "结合主角描述的水彩风插画提示词" }
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: `${prompt}, watercolor art style, hand-painted on textured paper, soft edges, whimsical lighting, high quality illustration for children's book.` }] }],
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
