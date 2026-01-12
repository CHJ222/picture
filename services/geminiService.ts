
import { GoogleGenAI, Type } from "@google/genai";

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

export const createMagicStoryBook = async (heroBlob: Blob, storyBlob: Blob): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const heroBase64 = await blobToBase64(heroBlob);
  const storyBase64 = await blobToBase64(storyBlob);

  const systemInstruction = `你是一位天才儿童绘本作家和动漫导演。
你的任务是根据用户的“主角视频”和“故事叙述视频”创作一个精彩的5页绘本。

**步骤 1：角色建模**
从 'hero_video' 中提取主角的视觉特征：性别、肤色、发型/发色、眼镜、服装。生成一个简短的英文视觉标签串 (visualDescription)。

**步骤 2：剧情编排**
将 'story_video' 的内容改编为一个逻辑清晰、富有想象力的童话故事。

**步骤 3：输出 JSON**
- title: 绘本标题
- character: { name: 主角名字, visualDescription: 英文视觉特征串 }
- scenes: 5个场景，每个包含 narration (中文旁白) 和 imagePrompt (用于 DALL-E/Gemini 的英文生图提示词)。
  - imagePrompt 必须包含 visualDescription，并描述具体动作和环境。
  - 风格要求：Japanese anime, Studio Ghibli inspired, vibrant colors, magical atmosphere, detailed backgrounds.`;

  // 使用 gemini-3-pro-preview 进行复杂推理
  const textResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [
      {
        parts: [
          { inlineData: { data: heroBase64, mimeType: 'video/webm' } },
          { inlineData: { data: storyBase64, mimeType: 'video/webm' } },
          { text: "开始魔法创作！请确保主角在每一页的形象高度一致。" }
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
              visualDescription: { type: Type.STRING }
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
                imagePrompt: { type: Type.STRING }
              },
              required: ["pageNumber", "narration", "imagePrompt"]
            }
          }
        },
        required: ["title", "character", "scenes"]
      }
    }
  });

  const storyData = JSON.parse(textResponse.text);
  
  // 逐一生成插画
  for (let scene of storyData.scenes) {
    scene.imageUrl = await generateMagicImage(scene.imagePrompt);
  }

  return storyData;
};

const generateMagicImage = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const finalPrompt = `${prompt}, beautiful digital art, anime style, clean line art, high resolution, soft lighting, magical sparkles.`;
    
    // 使用 gemini-2.5-flash-image 生图
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
    console.error("Magic drawing failed:", e);
  }
  return 'https://picsum.photos/600/600?random=' + Math.random();
};
