
import { useState, useRef, useCallback, useEffect } from 'react';
import { RecordMode } from '../types';

export const LIMITS = {
  protagonist: 30, // 30秒
  story: 180,     // 3分钟 (180秒)
};

export const useRecorder = (onFinish: (blob: Blob, mode: RecordMode, duration: number) => void) => {
  const [isRecording, setIsRecording] = useState(false);
  const [activeRecordMode, setActiveRecordMode] = useState<RecordMode | null>(null); // 新增：记录当前正在录制的模式
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const currentModeRef = useRef<RecordMode | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const initCamera = useCallback(async (mode?: 'user' | 'environment') => {
    try {
      setError(null);
      // 如果正在运行，先停止旧流
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
    if (isRecording) return; // 录制中不允许翻转以防崩溃
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    await initCamera(newMode);
  }, [facingMode, isRecording, initCamera]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setActiveRecordMode(null); // 重置录制模式
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isRecording]);

  const startRecording = useCallback(async (mode: RecordMode) => {
    let currentStream = stream;
    if (!currentStream) {
      currentStream = await initCamera();
    }
    
    if (!currentStream) return;

    currentModeRef.current = mode;
    setActiveRecordMode(mode); // 设置当前录制模式
    chunksRef.current = [];
    startTimeRef.current = Date.now();
    
    const recorder = new MediaRecorder(currentStream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
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
  }, [stream, initCamera, onFinish, stopRecording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      // 注意：这里不直接调用 stopStream 以免切换页面时出现竞态
    };
  }, []);

  return {
    isRecording,
    activeRecordMode, // 导出此状态供 UI 使用
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
