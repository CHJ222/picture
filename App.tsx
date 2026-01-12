
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Page, VideoSnippet, MagicStory, RecordMode } from './types';
import { ICONS } from './constants';
import Button from './components/Button';
import Card from './components/Card';
import { createMagicStoryBook } from './services/geminiService';
import { useRecorder } from './hooks/useRecorder';
import confetti from 'canvas-confetti';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home);
  const [snippets, setSnippets] = useState<VideoSnippet[]>([]);
  const [story, setStory] = useState<MagicStory | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [magicQuote, setMagicQuote] = useState("正在收集星星碎片...");

  const videoRef = useRef<HTMLVideoElement>(null);

  const quotes = [
    "正在召唤灵感精灵...",
    "正在给梦境涂色...",
    "正在编织奇妙的情节...",
    "正在捕捉主角的小秘密...",
    "魔法咒语正在生效中...",
    "绘本正在秘密花园里生长..."
  ];

  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setMagicQuote(quotes[Math.floor(Math.random() * quotes.length)]);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

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
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD93D', '#6EB5FF', '#FF8989', '#C1A3FF']
      });
      stopStream();
    } catch (err: any) {
      console.error(err);
      alert(`魔法中断了！可能是猫咪踩到了电线：${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 修改：添加 safe-pt 和 safe-pb，使用 min-h-dvh
  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-dvh p-6 text-center max-w-[430px] mx-auto relative overflow-hidden safe-pt safe-pb">
      <div className="absolute top-10 left-10 animate-float opacity-40"><ICONS.Cloud /></div>
      <div className="absolute top-40 right-10 animate-float delay-75 opacity-30 scale-75"><ICONS.Cloud /></div>
      <div className="absolute bottom-40 left-5 magic-sparkle opacity-60"><ICONS.Star /></div>
      
      <div className="relative z-10">
        <div className="text-8xl mb-6 animate-float">📖</div>
        <h1 className="text-6xl font-black text-[#2D3436] mb-4 tracking-tighter">
          魔法绘本<br/><span className="text-[#FF8989]">制造机</span>
        </h1>
        <p className="text-xl font-bold text-gray-500 mb-12">把你录下来的故事变成真正的画册</p>
        
        <Button color="yellow" size="xl" onClick={() => { setCurrentPage(Page.Record); initCamera(); }} className="px-16 py-8 rounded-[4rem]">
          <span className="text-3xl">开启魔法</span>
          <span className="text-4xl">🪄</span>
        </Button>
      </div>

      <div className="absolute bottom-10 text-gray-400 font-bold text-sm safe-pb">
        适用于 4-10 岁的小小探险家
      </div>
    </div>
  );

  // 修改：添加 safe-pt 和 safe-pb 到容器
  const renderRecord = () => (
    <div className="flex flex-col min-h-dvh bg-[#E3F2FD] px-4 max-w-[430px] mx-auto border-x-4 border-black relative safe-pt safe-pb">
      <header className="flex justify-between items-center mb-4 pt-2">
        <Button color="white" size="sm" onClick={() => { stopStream(); setCurrentPage(Page.Home); }}>🏠 退出</Button>
        <div className="px-4 py-2 bg-white rounded-full border-2 border-black font-black text-sm">
          已收集: {snippets.length}
        </div>
      </header>

      <div className="relative w-full aspect-square bg-black rounded-[2.5rem] border-4 border-black overflow-hidden neubrutalism-shadow mb-6 shrink-0">
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline 
          className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
        />
        
        {isRecording && (
          <div className="absolute top-4 left-4 bg-red-500 text-white px-4 py-1 rounded-full border-2 border-black font-black flex items-center gap-2 animate-pulse">
             <div className="w-2 h-2 bg-white rounded-full"></div>
             {timeLeft}s
          </div>
        )}

        <button 
          onClick={toggleCamera}
          className="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-full border-4 border-black flex items-center justify-center text-xl bouncy active:scale-90"
        >
          🔄
        </button>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <Card color={snippets.some(s => s.type === 'protagonist') ? 'green' : 'white'} className="p-3 text-center border-2">
            <div className="text-3xl mb-1">🎭</div>
            <div className="text-[10px] font-black mb-2">第1步: 介绍主角</div>
            <Button 
              color="pink" 
              size="sm" 
              className="w-full text-sm"
              onClick={() => (isRecording && activeRecordMode === 'protagonist') ? stopRecording() : startRecording('protagonist')}
            >
              {(isRecording && activeRecordMode === 'protagonist') ? '停止' : '开始录制'}
            </Button>
          </Card>
          <Card color={snippets.some(s => s.type === 'story') ? 'blue' : 'white'} className="p-3 text-center border-2">
            <div className="text-3xl mb-1">📢</div>
            <div className="text-[10px] font-black mb-2">第2步: 讲讲情节</div>
            <Button 
              color="blue" 
              size="sm" 
              className="w-full text-sm"
              onClick={() => (isRecording && activeRecordMode === 'story') ? stopRecording() : startRecording('story')}
            >
              {(isRecording && activeRecordMode === 'story') ? '停止' : '开始录制'}
            </Button>
          </Card>
        </div>
      </div>

      <div className="bg-white border-4 border-black rounded-[2rem] p-4 flex-1 flex flex-col overflow-hidden min-h-[100px]">
        <h3 className="font-black text-sm mb-2">🔮 魔法素材库</h3>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
          {snippets.map(s => (
            <div key={s.id} className="flex items-center gap-2 bg-[#F9F9F9] p-2 rounded-xl border-2 border-black">
              <div className="w-10 h-10 bg-black rounded-lg overflow-hidden shrink-0">
                <video src={s.url} className="w-full h-full object-cover" muted />
              </div>
              <div className="flex-1 text-[10px] font-black">
                {s.type === 'protagonist' ? '🦸 主角片段' : '📖 故事内容'}
              </div>
              <button onClick={() => setSnippets(p => p.filter(x => x.id !== s.id))} className="text-sm">🗑️</button>
            </div>
          ))}
          {snippets.length === 0 && <div className="py-4 text-center text-gray-400 text-xs italic">还没有收集到素材...</div>}
        </div>
        
        <Button 
          color={canGenerate ? 'green' : 'yellow'} 
          disabled={!canGenerate} 
          onClick={() => setCurrentPage(Page.Generate)} 
          className={`mt-4 w-full py-4 ${canGenerate ? 'animate-bounce' : 'opacity-40'}`}
        >
           施展绘本魔法 ✨
        </Button>
      </div>

      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6" onClick={() => setPreviewVideo(null)}>
          <video src={previewVideo} controls autoPlay className="w-full rounded-2xl border-4 border-white" />
          <p className="mt-4 text-white font-bold">点击任意位置关闭</p>
        </div>
      )}
    </div>
  );

  const renderGenerate = () => (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-[#C1A3FF] p-8 text-center max-w-[430px] mx-auto safe-pt safe-pb">
      {isGenerating ? (
        <div className="space-y-8">
           <div className="relative">
              <div className="text-9xl animate-spin-slow">🔮</div>
              <div className="absolute inset-0 flex items-center justify-center text-4xl">✨</div>
           </div>
           <div className="space-y-4">
             <h2 className="text-3xl font-black text-white">{magicQuote}</h2>
             <div className="w-full bg-black/20 h-4 rounded-full border-2 border-black overflow-hidden relative">
                <div className="bg-white h-full animate-[loading_10s_ease-in-out_infinite] w-full origin-left"></div>
             </div>
           </div>
        </div>
      ) : (
        <div className="space-y-8 animate-float">
           <div className="text-9xl">🧙‍♂️</div>
           <h2 className="text-4xl font-black text-white">咒语已准备好！</h2>
           <p className="text-white font-bold">准备好见证奇迹了吗？</p>
           <Button color="yellow" size="xl" onClick={handleGenerateMagic} className="rounded-full px-16 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
             激活魔法！
           </Button>
        </div>
      )}
    </div>
  );

  // 修改：Header 增加 paddingTop, Footer 增加 paddingBottom
  const renderResult = () => {
    if (!story) return null;
    const currentScene = story.scenes[activePage];

    return (
      <div className="flex flex-col min-h-dvh bg-[#FFF9E1] max-w-[430px] mx-auto border-x-4 border-black relative overflow-hidden">
        <header className="p-4 flex justify-between items-center border-b-4 border-black bg-white safe-pt">
          <Button color="pink" size="sm" onClick={() => setCurrentPage(Page.Home)}>🏠 首页</Button>
          <div className="flex-1 text-center px-4">
            <h2 className="font-black text-lg truncate">《{story.title}》</h2>
          </div>
          <div className="w-10"></div>
        </header>

        <main className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
          <div className="relative aspect-square w-full rounded-[2rem] border-4 border-black overflow-hidden bg-white neubrutalism-shadow group shrink-0">
            <img 
              key={currentScene.imageUrl}
              src={currentScene.imageUrl} 
              className="w-full h-full object-cover animate-[fadeIn_0.5s_ease-out]" 
              alt="Story page" 
            />
            <div className="absolute top-4 left-4 bg-white/90 border-2 border-black px-3 py-1 rounded-full text-[10px] font-black">
              AI 画笔: 魔法风格
            </div>
            <div className="absolute bottom-4 right-4 bg-[#FFD93D] border-2 border-black px-4 py-1 rounded-full font-black text-sm">
              第 {activePage + 1} 页
            </div>
          </div>

          <div className="bg-white border-4 border-black rounded-[2rem] p-6 neubrutalism-shadow flex-1 relative min-h-[150px]">
            <div className="absolute -top-3 left-6 px-4 py-1 bg-[#6EB5FF] border-2 border-black rounded-full text-xs font-black text-white">
              故事旁白
            </div>
            <p className="text-xl font-bold leading-relaxed text-gray-800">
              {currentScene.narration}
            </p>
          </div>
        </main>

        <footer className="p-4 bg-white border-t-4 border-black flex gap-4 safe-pb">
          <Button 
            color="white" 
            className={`flex-1 ${activePage === 0 ? 'opacity-30' : ''}`} 
            disabled={activePage === 0}
            onClick={() => setActivePage(p => p - 1)}
          >
            ← 上一页
          </Button>
          <Button 
            color={activePage === story.scenes.length - 1 ? 'green' : 'yellow'} 
            className="flex-1"
            onClick={() => {
              if (activePage === story.scenes.length - 1) {
                alert("你读完了整个故事！太棒了！🌈");
              } else {
                setActivePage(p => p + 1);
              }
            }}
          >
            {activePage === story.scenes.length - 1 ? '读完了！✨' : '下一页 →'}
          </Button>
        </footer>
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
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.7); }
          100% { transform: scaleX(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default App;
