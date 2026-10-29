import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface AudioVisualizerProps {
  audioStream?: MediaStream | null;
  isActive?: boolean;
  size?: number;
  color?: string;
  sensitivity?: number;
  barCount?: number;
}

const LEVEL_EPSILON = 0.02;

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioStream,
  isActive = true,
  size = 56,
  color = "rgba(255, 255, 255, 0.8)",
  sensitivity = 1.2,
  barCount = 8,
}) => {
  const [levels, setLevels] = useState<number[]>(() => new Array(barCount).fill(0));
  const levelsRef = useRef<number[]>(new Array(barCount).fill(0));

  useEffect(() => {
    if (!audioStream || !isActive || audioStream.getAudioTracks().length === 0) return;

    let disposed = false;
    let frameId: number | null = null;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioContext.createMediaStreamSource(audioStream);
    source.connect(analyser);

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const binsPerBar = Math.max(1, Math.floor(frequencyData.length / barCount));

    void audioContext.resume().catch(() => {});

    const tick = () => {
      if (disposed) return;

      analyser.getByteFrequencyData(frequencyData);

      const nextLevels: number[] = [];
      for (let i = 0; i < barCount; i++) {
        const start = i * binsPerBar;
        const end = Math.min(start + binsPerBar, frequencyData.length);

        let sum = 0;
        let peak = 0;
        for (let j = start; j < end; j++) {
          sum += frequencyData[j];
          peak = Math.max(peak, frequencyData[j]);
        }

        const average = sum / (end - start);
        const combined = ((average * 0.4 + peak * 0.6) / 255) * sensitivity;
        nextLevels.push(Math.min(combined, 1));
      }

      const hasChanged = nextLevels.some(
        (value, index) => Math.abs(value - levelsRef.current[index]) > LEVEL_EPSILON
      );
      if (hasChanged) {
        levelsRef.current = nextLevels;
        setLevels(nextLevels);
      }

      frameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      disposed = true;
      if (frameId !== null) cancelAnimationFrame(frameId);
      source.disconnect();
      analyser.disconnect();
      if (audioContext.state !== "closed") void audioContext.close().catch(() => {});

      const idleLevels = new Array(barCount).fill(0);
      levelsRef.current = idleLevels;
      setLevels(idleLevels);
    };
  }, [audioStream, isActive, barCount, sensitivity]);

  const barWidth = Math.max(2, Math.round(size / 16));
  const barGap = Math.max(2, Math.round(size / 24));

  return (
    <div className="mimin:flex mimin:items-center mimin:justify-center" style={{ width: size, height: size }}>
      <div className="mimin:flex mimin:items-center mimin:justify-center" style={{ gap: barGap, height: size }}>
        {levels.map((value, index) => (
          <motion.div
            key={index}
            className="mimin:rounded-full"
            style={{
              width: barWidth,
              backgroundColor: color,
              opacity: 0.7 + value * 0.3,
            }}
            animate={{ height: Math.max(barWidth, value * size * 0.8) }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        ))}
      </div>
    </div>
  );
};
