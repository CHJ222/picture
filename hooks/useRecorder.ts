
import { useState, useRef, useCallback, useEffect } from 'react';
import { RecordMode } from '../types';

export const LIMITS = {
  protagonist: 30, // 30秒
  story: 180,     // 3分钟 (180秒)
};

export const useRecorder = (onFinish: (blob: Blob, mode: RecordMode, duration: number) => void) => {
  const [isRecording, setIsRecording] = useState(false);
  const [activeRecordMode, setActiveRecordMode] = useState<RecordMode | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const currentModeRef = useRef<RecordMode | null>(null);
  const startTimeRef = useRef<number>(0);
  // 新增：用于存储当前录制实际使用的 MIME type
  const mimeTypeRef = useRef<string>('video/webm');

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const initCamera = useCallback(async (mode?: 'user' | 'environment') => {
    try {
      setError(null);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const targetMode = mode || facingMode;
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          facingMode: targetMode 
        }, 
        audio: true 
      });
      setStream(newStream);
      setFacingMode(targetMode);
      return newStream;
    } catch (err) {
      console.error("Camera init error:", err);
      setError('permission_denied');
      return null;
    }
  }, [facingMode, stream]);

  const toggleCamera = useCallback(async () => {
    if (isRecording) return;
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    await initCamera(newMode);
  }, [facingMode, isRecording, initCamera]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setActiveRecordMode(null);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isRecording]);

  // 核心修改：检测浏览器支持的最佳 MIME Type
  const getSupportedMimeType = () => {
    const types = [
      'video/mp4',             // Safari 优先
      'video/webm;codecs=vp9', // Chrome 高质量
      'video/webm;codecs=vp8', // Chrome 兼容
      'video/webm'             // 通用后备
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // 让浏览器使用默认值
  };

  const startRecording = useCallback(async (mode: RecordMode) => {
    let currentStream = stream;
    if (!currentStream) {
      currentStream = await initCamera();
    }
    
    if (!currentStream) return;

    currentModeRef.current = mode;
    setActiveRecordMode(mode);
    chunksRef.current = [];
    startTimeRef.current = Date.now();
    
    const mimeType = getSupportedMimeType();
    mimeTypeRef.current = mimeType; // 记录选中的格式

    // 传入 mimeType 选项
    const options = mimeType ? { mimeType } : undefined;
    
    try {
      const recorder = new MediaRecorder(currentStream, options);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
        // 使用记录的 mimeType 创建 Blob，确保 iOS 能识别
        // 如果 mimeType 为空（默认），则尝试用 recorder.mimeType，最后兜底 video/webm
        const finalType = mimeTypeRef.current || recorder.mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: finalType });
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        onFinish(blob, mode, duration);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      
      const limit = LIMITS[mode];
      setTimeLeft(limit);

      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e) {
      console.error("Failed to create MediaRecorder:", e);
      alert("无法启动录制，请检查手机兼容性或使用 Chrome 浏览器。");
      setIsRecording(false);
      setActiveRecordMode(null);
    }
  }, [stream, initCamera, onFinish, stopRecording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    isRecording,
    activeRecordMode,
    timeLeft,
    error,
    stream,
    facingMode,
    startRecording,
    stopRecording,
    initCamera,
    stopStream,
    toggleCamera
  };
};
