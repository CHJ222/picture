
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Page, VideoSnippet, MagicStory, RecordMode } from './types';
import { ICONS } from './constants';
import Button from './components/Button';
import Card from './components/Card';
import { createMagicStoryBook } from './services/geminiService';
import { useRecorder } from './hooks/useRecorder';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home);
  const [snippets, setSnippets] = useState<VideoSnippet[]>([]);
  const [story, setStory] = useState<MagicStory | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  const handleRecordingFinish = (blob: Blob, mode: RecordMode, duration: number) => {
    const url = URL.createObjectURL(blob);
    setSnippets(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      blob, url, type: mode, timestamp: Date.now(), duration
    }]);
  };

  const { 
    isRecording,
    activeRecordMode,
    timeLeft, 
    stream, 
    facingMode,
    startRecording, 
    stopRecording, 
    initCamera, 
    stopStream, 
    toggleCamera 
  } = useRecorder(handleRecordingFinish);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const canGenerate = useMemo(() => {
    return snippets.some(s => s.type === 'protagonist') && snippets.some(s => s.type === 'story');
  }, [snippets]);

  const handleGenerateMagic = async () => {
    setIsGenerating(true);
    try {
      const heroSnippet = snippets.find(s => s.type === 'protagonist')!.blob;
      const storySnippet = snippets.find(s => s.type === 'story')!.blob;
      
      const result = await createMagicStoryBook(heroSnippet, storySnippet);
      setStory(result);
      setCurrentPage(Page.Result);
      stopStream();
    } catch (err: any) {
      console.error(err);
      // 显示具体的错误信息，方便排查
      alert(`魔法中断了！\n原因：${err.message || '未知错误'}\n\n请检查网络或 API Key 设置。`);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#FFF9E1] p-6 text-center max-w-[430px] mx-auto border-x-4 border-black relative overflow-hidden">
      <div className="absolute top-10 left-10 animate-float-slow opacity-50"><ICONS.Cloud /></div>
      <div className="absolute bottom-20 right-5 animate-float opacity-30"><ICONS.Star /></div>
      <h1 className="text-6xl font-black text-[#2D3436] mb-12 drop-shadow-lg leading-tight">魔法绘本<br/>制造机</h1>
      <Button color="yellow" size="xl" onClick={() => { setCurrentPage(Page.Record); initCamera(); }} className="rounded-[4rem] px-16 group">
        <div className="flex flex-col items-center group-hover:scale-110 transition-transform">
          <span className="text-8xl mb-4">📸</span>
          <span className="text-3xl">神奇相机</span>
        </div>
      </Button>
      <p className="mt-8 text-xl font-bold text-gray-600 animate-pulse">拍出你自己的绘本故事</p>
    </div>
  );

  const renderRecord = () => (
    <div className="flex flex-col min-h-screen bg-[#E3F2FD] p-4 max-w-[430px] mx-auto border-x-4 border-black relative overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <Button color="yellow" size="sm" onClick={() => { stopStream(); setCurrentPage(Page.Home); }}>⬅️ 离开</Button>
        <div className="flex gap-2 bg-white/50 px-3 py-1 rounded-full border-2 border-black">
           <div className={`w-4 h-4 rounded-full border-2 border-black ${snippets.some(s => s.type === 'protagonist') ? 'bg-green-400' : 'bg-white'}`}></div>
           <div className={`w-4 h-4 rounded-full border-2 border-black ${snippets.some(s => s.type === 'story') ? 'bg-blue-400' : 'bg-white'}`}></div>
        </div>
      </div>

      <div className="relative w-full aspect-[3/4] bg-black rounded-[2.5rem] border-4 border-black overflow-hidden neubrutalism-shadow mb-6">
        {/* 摄像头画面：前置摄像头（user）需要镜像翻转，后置则不需要 */}
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline // 关键：iOS 必须属性
          className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
        />
        
        {/* 翻转摄像头按钮 */}
        {!isRecording && (
          <button 
            onClick={toggleCamera}
            className="absolute bottom-4 right-4 w-14 h-14 bg-white rounded-full border-4 border-black flex items-center justify-center text-2xl neubrutalism-shadow-sm bouncy active:scale-90 z-20"
          >
            🔄
          </button>
        )}

        {isRecording && (
          <div className="absolute top-4 left-4 bg-red-100 text-red-500 px-4 py-2 rounded-full border-2 border-black font-black flex items-center gap-2 animate-pulse z-10">
             <div className="w-3 h-3 bg-red-500 rounded-full"></div>
             REC {timeLeft}s
          </div>
        )}
        {!stream && (
           <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
             <div className="text-6xl animate-spin">🌀</div>
           </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card color={snippets.some(s => s.type === 'protagonist') ? 'green' : 'white'} className="p-4 flex flex-col items-center justify-between min-h-[140px] text-center">
          <span className="text-4xl">🦸‍♂️</span>
          <div className="text-xs font-black">1. 介绍主角</div>
          <Button 
            color="pink" 
            size="sm" 
            disabled={isRecording && activeRecordMode !== 'protagonist'}
            onClick={() => (isRecording && activeRecordMode === 'protagonist') ? stopRecording() : startRecording('protagonist')}
          >
            {(isRecording && activeRecordMode === 'protagonist') ? '停止' : '开始'}
          </Button>
        </Card>
        <Card color={snippets.some(s => s.type === 'story') ? 'blue' : 'white'} className="p-4 flex flex-col items-center justify-between min-h-[140px] text-center">
          <span className="text-4xl">📚</span>
          <div className="text-xs font-black">2. 讲精彩故事</div>
          <Button 
            color="blue" 
            size="sm" 
            disabled={isRecording && activeRecordMode !== 'story'}
            onClick={() => (isRecording && activeRecordMode === 'story') ? stopRecording() : startRecording('story')}
          >
            {(isRecording && activeRecordMode === 'story') ? '停止' : '开始'}
          </Button>
        </Card>
      </div>

      <div className="bg-white border-4 border-black rounded-[2rem] p-4 flex-1 overflow-hidden flex flex-col">
        <h3 className="font-black mb-2 flex items-center gap-2 text-sm">🎁 魔法素材 ({snippets.length})</h3>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
          {snippets.length === 0 && <p className="text-center text-gray-400 py-8 italic font-bold">还没有录制片段哦~</p>}
          {snippets.map(s => (
            <div key={s.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border-2 border-black hover:bg-yellow-50 transition-colors">
              <div className="w-12 h-12 bg-black rounded-lg overflow-hidden cursor-pointer relative group" onClick={() => setPreviewVideo(s.url)}>
                {/* 
                   重要修改：
                   1. playsInline: 允许在 iOS 上内嵌播放
                   2. muted: 静音，很多移动浏览器不静音不允许自动加载画面/自动播放
                   3. object-cover: 填满容器
                */}
                <video src={s.url} className="w-full h-full object-cover" playsInline muted />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 text-white text-[10px]">▶️</div>
              </div>
              <div className="flex-1 text-[10px] font-black">
                {s.type === 'protagonist' ? '🦸 主角' : '📖 故事'} · {s.duration}s
              </div>
              <button onClick={() => setSnippets(p => p.filter(x => x.id !== s.id))} className="w-8 h-8 bg-red-100 rounded-full border-2 border-black flex items-center justify-center">🗑️</button>
            </div>
          ))}
        </div>
        <Button color={canGenerate ? 'green' : 'yellow'} disabled={!canGenerate} onClick={() => setCurrentPage(Page.Generate)} className={`mt-4 w-full py-4 rounded-2xl ${canGenerate ? 'animate-bounce' : 'opacity-50 grayscale'}`}>
           ✨ 施展绘本魔法
        </Button>
      </div>

      {previewVideo && (
        <div className="absolute inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4">
          <video 
            src={previewVideo} 
            controls 
            autoPlay 
            playsInline // 关键：iOS 必须属性
            className="w-full rounded-2xl border-4 border-yellow-400 shadow-[0_0_20px_rgba(255,217,61,0.5)]" 
          />
          <Button color="pink" className="mt-8" onClick={() => setPreviewVideo(null)}>关闭预览</Button>
        </div>
      )}
    </div>
  );

  const renderGenerate = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-purple-100 p-8 text-center max-w-[430px] mx-auto border-x-4 border-black">
      {isGenerating ? (
        <div className="space-y-10">
           <div className="text-9xl animate-spin-slow">🪄</div>
           <div className="space-y-4">
             <h2 className="text-4xl font-black text-purple-600 animate-pulse">正在编织梦境...</h2>
             <p className="font-bold text-gray-500 leading-relaxed px-4">正在分析你的样子，<br/>并把你的故事画成美丽的图画！</p>
           </div>
           <div className="w-full bg-white h-4 rounded-full border-4 border-black overflow-hidden">
              <div className="bg-purple-500 h-full animate-[loading_15s_ease-in-out_infinite]" style={{width: '60%'}}></div>
           </div>
        </div>
      ) : (
        <div className="space-y-12">
           <div className="text-9xl animate-float">🧙‍♂️</div>
           <h2 className="text-4xl font-black">咒语已就绪！</h2>
           <p className="font-bold text-gray-600">点击下方按钮，见证绘本诞生！</p>
           <Button color="purple" size="xl" onClick={handleGenerateMagic} className="rounded-full px-20">开始施法！</Button>
        </div>
      )}
    </div>
  );

  const renderResult = () => {
    if (!story) return null;
    const currentScene = story.scenes[activePage];

    return (
      <div className="flex flex-col min-h-screen bg-[#FFF9E1] p-6 max-w-[430px] mx-auto border-x-4 border-black overflow-hidden relative">
        <div className="flex justify-between items-center mb-4">
          <Button color="blue" size="sm" onClick={() => { if(confirm('确定要回到首页吗？你的魔法绘本会消失哦~')) setCurrentPage(Page.Home); }}>🏠 首页</Button>
          <span className="font-black text-lg truncate max-w-[180px]">《{story.title}》</span>
          <div className="w-8"></div>
        </div>

        {/* 翻页内容 */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <Card className="p-2 border-8 aspect-square relative overflow-hidden group neubrutalism-shadow">
            <img src={currentScene.imageUrl} className="w-full h-full object-cover rounded-[1.5rem]" alt={`Page ${activePage + 1}`} />
            <div className="absolute top-4 left-4 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full font-bold">
              AI 魔法生成
            </div>
            <div className="absolute bottom-4 right-4 bg-white/90 px-3 py-1 rounded-full border-2 border-black font-black text-sm">
              第 {activePage + 1} / {story.scenes.length} 页
            </div>
          </Card>

          <Card color="white" className="flex-1 p-6 border-4 border-dashed relative flex flex-col">
            {/* 主角信息展示 - 仅在第一页或特定位置强化 */}
            {activePage === 0 && (
              <div className="mb-3 px-3 py-1 bg-pink-100 border-2 border-black rounded-full inline-flex items-center gap-2 self-start">
                <span className="text-xs">✨</span>
                <span className="text-[10px] font-black">主角：{story.character.name}</span>
              </div>
            )}
            <div className="text-2xl leading-relaxed font-bold text-gray-700 h-full overflow-y-auto scrollbar-hide">
               {currentScene.narration}
            </div>
          </Card>
        </div>

        {/* 导航控制 */}
        <div className="flex gap-4 mt-6">
          <Button 
            color="yellow" 
            className={`flex-1 ${activePage === 0 ? 'opacity-30' : ''}`} 
            disabled={activePage === 0}
            onClick={() => setActivePage(p => p - 1)}
          >
            上一步
          </Button>
          <Button 
            color={activePage === story.scenes.length - 1 ? 'pink' : 'green'} 
            className="flex-1"
            onClick={() => {
              if (activePage === story.scenes.length - 1) {
                alert("太棒了！你完成了一个了不起的故事！👏");
              } else {
                setActivePage(p => p + 1);
              }
            }}
          >
            {activePage === story.scenes.length - 1 ? '读完了！' : '下一步'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="font-sans">
      {currentPage === Page.Home && renderHome()}
      {currentPage === Page.Record && renderRecord()}
      {currentPage === Page.Generate && renderGenerate()}
      {currentPage === Page.Result && renderResult()}
      
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default App;
