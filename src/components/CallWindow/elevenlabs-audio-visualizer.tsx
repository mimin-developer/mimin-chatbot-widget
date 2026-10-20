'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ElevenLabsAudioVisualizerProps {
  frequencyData?: Uint8Array | null;
  isActive?: boolean;
  size?: number;
  color?: string;
  sensitivity?: number;
}

export const ElevenLabsAudioVisualizer: React.FC<ElevenLabsAudioVisualizerProps> = ({
  frequencyData,
  isActive = true,
  size = 56,
  color = 'rgba(255, 255, 255, 0.8)',
  sensitivity = 1
}) => {
  // Jika tidak aktif atau data kosong, tampilkan fallback
  if (!isActive || !frequencyData) {
    return (
      <div
        className="mimin:flex mimin:items-center mimin:justify-center"
        style={{ width: size, height: size }}
      >
        <div className="mimin:flex mimin:items-center mimin:justify-center mimin:animate-pulse">
          <span className="mimin:text-white mimin:text-sm">Idle...</span>
        </div>
      </div>
    );
  }

  // Improved frequency data processing for better responsiveness
  const bars: number[] = [];
  const numBars = 8;
  const barWidth = Math.floor(frequencyData.length / numBars);

  for (let i = 0; i < numBars; i++) {
    let sum = 0;
    let max = 0;
    const start = i * barWidth;
    const end = Math.min(start + barWidth, frequencyData.length);

    // Calculate both average and peak values for more dynamic response
    for (let j = start; j < end; j++) {
      const value = frequencyData[j] || 0;
      sum += value;
      max = Math.max(max, value);
    }

    const average = sum / (end - start);
    const peak = max;

    // Combine average and peak for more responsive visualization
    const combined = (average * 0.4 + peak * 0.6) / 255;

    // Apply sensitivity and add minimum movement for visual interest
    const normalized = Math.max(0.1, combined * sensitivity);
    bars.push(Math.min(normalized, 1.2)); // Allow slight overflow for dramatic effect
  }

  return (
    <div
      className="mimin:flex mimin:items-center mimin:justify-center"
      style={{ width: size, height: size }}
    >
      <div className="mimin:flex mimin:items-end mimin:justify-center mimin:space-x-1">
        {bars.map((value, index) => (
          <motion.div
            key={index}
            className="mimin:rounded-full mimin:bg-current"
            style={{
              width: Math.max(2, size / 16),
              minHeight: Math.max(2, size / 16),
              backgroundColor: color,
              opacity: 0.7 + value * 0.3
            }}
            animate={{
              height: Math.max(size / 16, value * size * 0.8),
              scaleY: 1 + value * 0.5
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30
            }}
          />
        ))}
      </div>
    </div>
  );
};
