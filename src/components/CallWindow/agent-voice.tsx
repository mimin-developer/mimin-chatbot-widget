import React, { useState, useEffect } from "react";
import { MdPhone } from "react-icons/md";
import { motion } from "framer-motion";
import {
  blinkingTextVariants,
  childVariants,
  containerVariants,
  hangUpButtonVariants,
} from "./animate";
import { GeminiAgentVoiceLayout } from "./gemini-agent-voice";
import { OpenAiAgentVoiceLayout } from "./openai-agent-voice";
import { useConfigStore } from "../../hooks/config-store";
import { createRealtimeSession } from "../../services";
import { getApiErrorMessage } from "../../utils";
import type { RealtimeSession } from "../../types";

interface AgentVoiceProps {
  isVisible: boolean;
  onToggleCallWindow: () => void;
  phone: string;
  chatbotAgentId?: string;
  voiceName?: string;
}

export const AgentVoiceLayout: React.FC<AgentVoiceProps> = ({
  isVisible,
  onToggleCallWindow,
  phone,
  chatbotAgentId,
  voiceName,
}) => {
  const [session, setSession] = useState<RealtimeSession | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { config } = useConfigStore();

  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const result = await createRealtimeSession({
          username: config?.credentials?.username,
          phone,
          chatbotAgentId,
        });
        if (!cancelled) setSession(result);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            getApiErrorMessage(
              error,
              "Gagal memulai panggilan. Silakan tutup dan coba lagi."
            )
          );
        }
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setSession(null);
      setErrorMessage(null);
    };
  }, [isVisible, phone, chatbotAgentId, config?.credentials?.username]);

  if (!isVisible) return null;

  if (!session) {
    return (
      <motion.div
        className="mimin:absolute mimin:inset-0 mimin:bg-white mimin:z-50"
        initial={false}
        animate="visible"
        exit="exit"
        // @ts-ignore
        variants={containerVariants}
      >
        <div className="mimin:h-full mimin:px-6 mimin:py-10 mimin:overflow-y-auto">
          <div className="mimin:flex mimin:flex-col mimin:items-center mimin:justify-center">
            <motion.h4
              className="mimin:text-[#0096a2] mimin:text-xl mimin:font-bold mimin:mb-6"
              variants={blinkingTextVariants}
              initial="initial"
              animate="animate"
            >
              {errorMessage ? "CALL FAILED" : "CONNECTING..."}
            </motion.h4>

            <div className="mimin:relative">
              <motion.div
                className="mimin:flex mimin:items-center mimin:justify-center mimin:p-4 mimin:rounded-full mimin:w-[204px] mimin:h-[204px] mimin:bg-gradient-to-br mimin:from-[#0096a2]/30 mimin:to-[#f26075]/30"
                animate={{
                  scale: [1, 1.02, 1],
                  transition: {
                    duration: 1.8,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut",
                  },
                }}
              />
            </div>

            {errorMessage && (
              <motion.p
                className="mimin:mt-4 mimin:px-3 mimin:py-2 mimin:rounded-lg mimin:bg-red-50 mimin:text-red-600 mimin:text-xs mimin:text-center mimin:max-w-[280px] mimin:break-words"
                // @ts-ignore
                variants={childVariants}
              >
                {errorMessage}
              </motion.p>
            )}

            <motion.p
              className="mimin:text-[#0096a2] mimin:text-base mimin:font-bold mimin:mt-5"
              // @ts-ignore
              variants={childVariants}
            >
              {config?.theme?.chatWindow?.header?.title || "MIMIN AI"}
            </motion.p>

            <motion.div
              className="mimin:h-[1.5px] mimin:w-full mimin:bg-gray-200 mimin:my-6"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            />

            <motion.div
              className="mimin:flex mimin:items-center mimin:justify-center mimin:w-full"
              // @ts-ignore
              variants={childVariants}
            >
              <motion.button
                type="button"
                aria-label="End call"
                className="mimin:rounded-full mimin:w-[60px] mimin:h-[60px] mimin:p-4 mimin:aspect-square mimin:flex mimin:items-center mimin:justify-center mimin:cursor-pointer mimin:bg-gradient-to-br mimin:from-[#0096a2]/30 mimin:to-[#f26075]/30"
                // @ts-ignore
                variants={hangUpButtonVariants}
                initial="initial"
                whileHover="hover"
                whileTap="tap"
                onClick={onToggleCallWindow}
              >
                <MdPhone className="mimin:w-full mimin:h-full mimin:text-[#f26075]/90 mimin:rotate-90" />
              </motion.button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    );
  }

  const providerProps = {
    isVisible,
    onToggleCallWindow,
    phone,
    chatbotAgentId,
    voiceName,
    session,
  };

  return session.provider === "gemini" ? (
    <GeminiAgentVoiceLayout {...providerProps} />
  ) : (
    <OpenAiAgentVoiceLayout {...providerProps} />
  );
};
