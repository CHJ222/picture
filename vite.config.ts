
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量，'' 表示加载所有变量（包括不带 VITE_ 前缀的）
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // 这里的逻辑是：
      // 1. 尝试读取 Vercel 里的 GEMINI_API_KEY (推荐使用这个名字)
      // 2. 如果没找到，尝试读取 API_KEY (兼容之前的设置)
      // 3. 将找到的值注入到前端代码的 process.env.API_KEY 中，供 geminiService.ts 使用
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY)
    }
  };
});
