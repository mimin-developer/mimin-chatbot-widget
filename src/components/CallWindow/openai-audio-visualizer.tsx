import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface AudioVisualizerProps {
  audioStream?: MediaStream | null;
  isActive?: boolean;
  size?: number;
  color?: string;
  sensitivity?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioStream,
  isActive = true,
  size = 56, // 14 * 4 (w-14 h-14)
  color = 'rgba(255, 255, 255, 0.8)',
  sensitivity = 1
}) => {
  const [audioData, setAudioData] = useState<number[]>(new Array(8).fill(0));
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Inisialisasi Web Audio API
  useEffect(() => {
    if (!audioStream || !isActive) {
      cleanup();
      return;
    }

    const setupAudioAnalysis = async () => {
      try {
        // Buat AudioContext
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Buat analyzer node
        analyzerRef.current = audioContextRef.current.createAnalyser();
        analyzerRef.current.fftSize = 64; // Ukuran FFT untuk 32 frequency bins
        analyzerRef.current.smoothingTimeConstant = 0.8;

        // Buat source dari media stream
        sourceRef.current = audioContextRef.current.createMediaStreamSource(audioStream);
        sourceRef.current.connect(analyzerRef.current);

        // Siapkan data array
        const bufferLength = analyzerRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);

        setIsAnalyzing(true);
        startAnalysis();
      } catch (error) {
        console.error('Error setting up audio analysis:', error);
      }
    };

    setupAudioAnalysis();

    return () => {
      cleanup();
    };
  }, [audioStream, isActive]);

  // Fungsi untuk membersihkan resources
  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }

    setIsAnalyzing(false);
    setAudioData(new Array(8).fill(0));
  };

  // Fungsi untuk memulai analisis audio
  const startAnalysis = () => {
    if (!analyzerRef.current || !dataArrayRef.current) return;

    const analyze = () => {
      if (!analyzerRef.current || !dataArrayRef.current) return;

      // @ts-ignore
      analyzerRef.current.getByteFrequencyData(dataArrayRef.current);

      // Proses data menjadi 8 bar untuk visualisasi
      const bars = [];
      const barWidth = Math.floor(dataArrayRef.current.length / 8);

      for (let i = 0; i < 8; i++) {
        let sum = 0;
        const start = i * barWidth;
        const end = start + barWidth;

        for (let j = start; j < end; j++) {
          sum += dataArrayRef.current[j];
        }

        // Normalisasi nilai (0-255) ke (0-1) dengan sensitivity
        const normalized = (sum / barWidth / 255) * sensitivity;
        bars.push(Math.min(normalized, 1));
      }

      setAudioData(bars);

      if (isActive) {
        animationFrameRef.current = requestAnimationFrame(analyze);
      }
    };

    analyze();
  };

  return (
    <div
      className="mimin:flex mimin:items-center mimin:justify-center"
      style={{ width: size, height: size }}
    >
      {isAnalyzing ? (
        // Real-time audio visualizer
        <div className="mimin:flex mimin:items-end mimin:justify-center mimin:space-x-1">
          {audioData.map((value, index) => (
            <motion.div
              key={index}
              className="mimin:rounded-full mimin:bg-current"
              style={{
                width: Math.max(2, size / 16),
                minHeight: Math.max(2, size / 16),
                backgroundColor: color,
                opacity: 0.7 + (value * 0.3)
              }}
              animate={{
                height: Math.max(size / 16, value * size * 0.8),
                scaleY: 1 + (value * 0.5)
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30
              }}
            />
          ))}
        </div>
      ) : (
        // Fallback animation (seperti sebelumnya)
        <div className="mimin:flex mimin:items-center mimin:justify-center mimin:animate-pulse">
          <span className="mimin:text-white mimin:text-sm">Connecting...</span>
        </div>
      )}
    </div>
  );
};

// Hook untuk menggunakan audio visualizer dengan SDP
export const useAudioVisualizer = () => {
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Fungsi untuk memulai listening (untuk microphone)
  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      setAudioStream(stream);
      setIsListening(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  // Fungsi untuk stop listening
  const stopListening = () => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }
    setIsListening(false);
  };

  // Fungsi untuk menggunakan audio stream dari SDP/WebRTC
  const setSDPAudioStream = (stream: MediaStream) => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
    }
    setAudioStream(stream);
    setIsListening(true);
  };

  return {
    audioStream,
    isListening,
    startListening,
    stopListening,
    setSDPAudioStream
  };
};

// Komponen yang sudah terintegrasi untuk CallWindow
export const OpenAIAudioVisualizer: React.FC<{
  audioStream?: MediaStream | null;
  isActive?: boolean;
}> = ({ audioStream, isActive = true }) => {
  return (
    <AudioVisualizer
      audioStream={audioStream}
      isActive={isActive}
      size={56}
      color="rgba(255, 255, 255, 0.8)"
      sensitivity={1.2}
    />
  );
};