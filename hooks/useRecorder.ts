
import { useState, useRef, useCallback, useEffect } from 'react';
import { RecordMode } from '../types';

export const LIMITS = {
  protagonist: 30, 
  story: 180,     
};

export const useRecorder = (onFinish: (blob: Blob, mode: RecordMode, duration: number, faceSnapshot?: Blob) => void) => {
  const [isRecording, setIsRecording] = useState(false);
  const [activeRecordMode, setActiveRecordMode] = useState<RecordMode | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isFlashActive, setIsFlashActive] = useState(false); // 闪光灯特效状态
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const currentModeRef = useRef<RecordMode | null>(null);
  const startTimeRef = useRef<number>(0);
  const mimeTypeRef = useRef<string>('video/webm');
  const capturedFaceBlobRef = useRef<Blob | undefined>(undefined);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const initCamera = useCallback(async (mode?: 'user' | 'environment') => {
    const targetMode = mode || facingMode;
    setError(null);

    const constraintsList = [
      { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: targetMode }, audio: true },
      { video: { facingMode: targetMode }, audio: true },
      { video: true, audio: true }
    ];

    for (const constraints of constraintsList) {
      try {
        if (stream) stream.getTracks().forEach(track => track.stop());
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(newStream);
        setFacingMode(targetMode);
        return newStream;
      } catch (err: any) {}
    }
    setError('not_found');
    return null;
  }, [facingMode, stream]);

  // 抓拍当前视频帧
  const captureFrame = useCallback(() => {
    const video = document.querySelector('video');
    if (!video || !stream) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // 如果是前置摄像头，需要镜像翻转
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          capturedFaceBlobRef.current = blob;
          setIsFlashActive(true);
          setTimeout(() => setIsFlashActive(false), 500); // 闪光效果持续 500ms
          console.log("📸 魔法抓拍：已捕捉高清正脸图");
        }
      }, 'image/jpeg', 0.9);
    }
  }, [stream, facingMode]);

  const toggleCamera = useCallback(async () => {
    if (isRecording) return;
    await initCamera(facingMode === 'user' ? 'environment' : 'user');
  }, [facingMode, isRecording, initCamera]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setActiveRecordMode(null);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isRecording]);

  const startRecording = useCallback(async (mode: RecordMode) => {
    let currentStream = stream;
    if (!currentStream || !currentStream.active) {
      currentStream = await initCamera();
    }
    if (!currentStream) return;

    currentModeRef.current = mode;
    setActiveRecordMode(mode);
    chunksRef.current = [];
    startTimeRef.current = Date.now();
    capturedFaceBlobRef.current = undefined;
    
    const types = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
    mimeTypeRef.current = mimeType;
    
    try {
      const recorder = new MediaRecorder(currentStream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || 'video/webm' });
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        onFinish(blob, mode, duration, capturedFaceBlobRef.current);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setTimeLeft(LIMITS[mode]);

      if (timerRef.current) clearInterval(timerRef.current);
      let ticks = 0;
      timerRef.current = window.setInterval(() => {
        ticks++;
        // 核心逻辑：如果是主角录制，在第 1.5 秒（约 ticks=3, 因为 500ms 计一次更准，这里暂定 1s）自动抓拍
        if (mode === 'protagonist' && ticks === 2) {
          captureFrame();
        }
        
        setTimeLeft(prev => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e) {
      setIsRecording(false);
    }
  }, [stream, initCamera, onFinish, stopRecording, captureFrame]);

  return {
    isRecording,
    activeRecordMode,
    timeLeft,
    error,
    stream,
    facingMode,
    isFlashActive,
    startRecording,
    stopRecording,
    initCamera,
    stopStream,
    toggleCamera
  };
};
