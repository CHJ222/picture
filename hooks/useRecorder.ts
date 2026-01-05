
import { useState, useRef, useCallback, useEffect } from 'react';
import { RecordMode } from '../types';

export const LIMITS = {
  protagonist: 30, // 30秒
  story: 180,     // 3分钟 (180秒)
};

export const useRecorder = (onFinish: (blob: Blob, mode: RecordMode, duration: number) => void) => {
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
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

  const initCamera = useCallback(async () => {
    try {
      setError(null);
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: 'user' }, 
        audio: true 
      });
      setStream(newStream);
      return newStream;
    } catch (err) {
      setError('permission_denied');
      return null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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
      stopStream();
    };
  }, [stopStream]);

  return {
    isRecording,
    timeLeft,
    error,
    stream,
    startRecording,
    stopRecording,
    initCamera,
    stopStream
  };
};
