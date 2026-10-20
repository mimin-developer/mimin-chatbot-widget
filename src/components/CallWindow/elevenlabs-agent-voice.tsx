'use client'

import React, { useEffect, useState, useCallback, useRef } from "react";
import { MdPhone } from "react-icons/md";
import { motion } from "framer-motion";
import {
  audioCircleVariants,
  blinkingTextVariants,
  childVariants,
  containerVariants,
  dividerVariants,
  hangUpButtonVariants,
} from "./animate";
import { useConfigStore } from "../../hooks/config-store";
import { useConversation } from "@elevenlabs/react";
import { API } from "../../services";
import { formatAudioCurrentTime, getApiErrorMessage } from "../../utils";
import { ElevenLabsAudioVisualizer } from "./elevenlabs-audio-visualizer";

interface ElevenLabsAgentVoiceProps {
  isVisible: boolean;
  onToggleCallWindow: () => void;
  phoneOrIP: { name: string, value: string } | null;
}

export const ElevenLabsAgentVoiceLayout: React.FC<ElevenLabsAgentVoiceProps> = ({
  isVisible,
  onToggleCallWindow,
  phoneOrIP
}) => {
  const { config } = useConfigStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const [time, setTime] = useState("00:00:00");
  const [callError, setCallError] = useState<string | null>(null);
  const [isStartSession, setIsStartSession] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const conversation = useConversation({
    onConnect: () => console.log("Connected to ElevenLabs"),
    onDisconnect: () => console.log("Disconnected from ElevenLabs"),
    onMessage: (message) => console.log("Message:", message),
    onError: (error) => console.log("Error:", error),
  });

  const handleHangUp = useCallback(async () => {
    setIsAnimating(true);
    try {
      await conversation.endSession();
    } catch (err) {
      console.error("Error ending session:", err);
    }
    setTimeout(() => {
      setIsStartSession(false);
      setTime("00:00:00");
      setCallError(null);
      onToggleCallWindow();
      setIsAnimating(false);
    }, 300);
  }, [conversation, onToggleCallWindow]);

  // Start ElevenLabs Realtime Session
  useEffect(() => {
    if (isVisible && phoneOrIP) {
      (async () => {
        try {
          setCallError(null);
          const res = await API('axios', 'customer')({
            url: `/v1/setting/eleven-labs/get-token/${config?.credentials?.username}`,
            method: 'GET',
            headers: {
              'x-api-key': config?.credentials?.apiKey
            }
          });

          const { token } = res.data;

          await navigator.mediaDevices.getUserMedia({ audio: true });
          await conversation.startSession({
            connectionType: 'webrtc',
            conversationToken: token,
            userId: phoneOrIP.value
          });
          setIsStartSession(true);
        } catch (error) {
          console.error("Failed to start conversation:", error);
          setCallError(getApiErrorMessage(error, "Gagal membuat sesi realtime"));
        }
      })();
    } else {
      (async () => {
        try { await conversation.endSession(); } catch { }
        setIsStartSession(false);
        setElapsedSeconds(0);
        setCallError(null);
      })();
    }
  }, [isVisible]);

  // Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isStartSession) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
        setTime(formatAudioCurrentTime(elapsedSeconds + 1));
      }, 1000);
    } else {
      setElapsedSeconds(0);
      setTime("00:00:00");
    }
    return () => clearInterval(interval);
  }, [isStartSession, elapsedSeconds]);

  if (!isVisible) return null;

  return (
    <motion.div
      className="mimin:absolute mimin:inset-0 mimin:bg-white mimin:z-10"
      initial="hidden"
      animate="visible"
      exit="exit"
      // @ts-ignore
      variants={containerVariants}
    >
      <div className="mimin:h-full mimin:p-4 mimin:sm:p-10 mimin:overflow-y-auto">
        <div className="mimin:flex mimin:h-full mimin:flex-col mimin:items-center mimin:justify-center">
          {/* Header */}
          <motion.h4
            className="mimin:text-[#0096a2] mimin:text-xl mimin:font-bold mimin:mb-6"
            variants={blinkingTextVariants}
            initial="initial"
            animate="animate"
          >
            {callError ? "CALL FAILED" : isStartSession ? "IN CALL" : "CONNECTING..."}
          </motion.h4>

          {/* Lingkaran Audio */}
          <div className="mimin:relative">
            <motion.div
              className="mimin:flex mimin:items-center mimin:justify-center mimin:p-4 mimin:rounded-full mimin:w-[204px] mimin:h-[204px] mimin:bg-gradient-to-br mimin:from-[#0096a2]/30 mimin:to-[#f26075]/30"
              // @ts-ignore
              variants={audioCircleVariants}
              initial="initial"
              animate="animate"
            >
              <motion.div
                className="mimin:flex mimin:items-center mimin:justify-center mimin:p-4 mimin:rounded-full mimin:w-full mimin:h-full mimin:bg-gradient-to-br mimin:from-[#0096a2]/40 mimin:to-[#f26075]/40"
                animate={{
                  scale: [1, 1.02, 1],
                  transition: {
                    duration: 1.8,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut",
                    delay: 0.2,
                  },
                }}
              >
                <motion.div
                  className="mimin:flex mimin:items-center mimin:justify-center mimin:p-4 mimin:rounded-full mimin:w-full mimin:h-full mimin:bg-gradient-to-br mimin:from-[#0096a2]/50 mimin:to-[#f26075]/50"
                  animate={{
                    scale: [1, 1.03, 1],
                    transition: {
                      duration: 1.6,
                      repeat: Infinity,
                      repeatType: "reverse",
                      ease: "easeInOut",
                      delay: 0.4,
                    },
                  }}
                />
              </motion.div>
            </motion.div>
            <div className="mimin:absolute mimin:inset-0 mimin:flex mimin:justify-center mimin:items-center">
              <ElevenLabsAudioVisualizer
                frequencyData={conversation.getInputByteFrequencyData()}
                isActive={isVisible}
                size={56}
                color="rgba(255, 255, 255, 0.8)"
                sensitivity={1.2}
              />
            </div>
            {isStartSession && (
              <div className="mimin:absolute mimin:text-white mimin:text-xs mimin:capitalize mimin:tracking-wide mimin:bottom-[25%] mimin:left-[50%] mimin:-translate-x-[50%] mimin:mt-4 mimin:animate-pulse">
                {conversation.isSpeaking ? "speaking" : "listening"}
              </div>
            )}
          </div>

          {callError && (
            <motion.p
              className="mimin:mt-4 mimin:px-3 mimin:py-2 mimin:rounded-lg mimin:bg-red-50 mimin:text-red-600 mimin:text-xs mimin:text-center mimin:max-w-[280px] mimin:break-words"
              // @ts-ignore
              variants={childVariants}
            >
              {callError}
            </motion.p>
          )}

          {/* Nama AI */}
          <motion.p
            className="mimin:text-[#0096a2] mimin:text-base mimin:font-bold mimin:mt-5"
            // @ts-ignore
            variants={childVariants}
          >
            {config?.theme?.chatWindow?.header?.title || "AI Assistant"}
          </motion.p>

          {/* Timer */}
          <motion.p
            className="mimin:text-[#0096a2] mimin:text-sm mimin:font-medium mimin:mt-0"
            // @ts-ignore
            variants={childVariants}
            key={time}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {time}
          </motion.p>

          {/* Divider */}
          <motion.div
            className="mimin:h-[1.5px] mimin:w-full mimin:bg-gray-200 mimin:my-6"
            // @ts-ignore
            variants={dividerVariants}
            initial="initial"
            animate="animate"
          />

          {/* Tombol Hang Up */}
          <motion.div
            className="mimin:grid mimin:grid-cols-2 mimin:gap-4 mimin:w-full"
            // @ts-ignore
            variants={childVariants}
          >
            <div className="mimin:col-span-2 mimin:flex mimin:items-center mimin:justify-center">
              <motion.button
                type="button"
                className="mimin:cursor-pointer mimin:bg-gradient-to-br mimin:from-[#0096a2]/30 mimin:to-[#f26075]/30 mimin:rounded-full mimin:w-[60px] mimin:h-[60px] mimin:p-4 mimin:aspect-square mimin:flex mimin:items-center mimin:justify-center"
                // @ts-ignore
                variants={hangUpButtonVariants}
                initial="initial"
                whileHover="hover"
                whileTap="tap"
                onClick={handleHangUp}
                disabled={isAnimating}
                animate={
                  isAnimating
                    ? {
                      scale: [1, 1.2, 0.8],
                      rotate: [0, 180, 360],
                      transition: { duration: 0.3 },
                    }
                    : {}
                }
              >
                <MdPhone className="mimin:w-full mimin:h-full mimin:text-[#f26075]/90 mimin:rotate-90" />
              </motion.button>
            </div>
          </motion.div>

          {/* Ripple Effect */}
          <motion.div
            className="mimin:absolute mimin:inset-0 mimin:pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="mimin:absolute mimin:top-1/2 mimin:left-1/2 mimin:w-4 mimin:h-4 mimin:bg-[#0096a2]/10 mimin:rounded-full"
                style={{
                  transform: "translate(-50%, -50%)",
                }}
                animate={{
                  scale: [0, 20, 0],
                  opacity: [0, 0.3, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 1,
                  ease: "easeOut",
                }}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
