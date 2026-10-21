import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { LoaderCircle, LogOut, Phone } from "lucide-react";
import { AgentVoiceLayout } from "../CallWindow/agent-voice";
import AuthWindow from "../Auth";
import { useConfigStore } from "../../hooks/config-store";
import type { ChatbotConfig } from "../../types";

const CALL_TOGGLE_COOLDOWN_MS = 5_000;

interface VoiceWidgetProps {
  config?: ChatbotConfig;
  voiceName?: string;
  phoneOrIP: { name: string; value: string } | null;
  isAuthenticated: boolean;
  sessionExpired?: boolean;
  onSuccessLogin: (token: string, phone: { phone: string; value: string }) => void;
  onLogout: () => void;
}

export const VoiceWidget: React.FC<VoiceWidgetProps> = ({
  config,
  voiceName,
  phoneOrIP,
  isAuthenticated,
  sessionExpired,
  onSuccessLogin,
  onLogout,
}) => {
  const [isCallVisible, setIsCallVisible] = useState(false);
  const [isCallToggleLocked, setIsCallToggleLocked] = useState(false);

  const { config: storeConfig } = useConfigStore();
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStartCall = () => {
    if (isCallToggleLocked || !phoneOrIP) return;
    setIsCallVisible(true);
  };

  const handleEndCall = () => {
    setIsCallVisible(false);
    setIsCallToggleLocked(true);
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      setIsCallToggleLocked(false);
    }, CALL_TOGGLE_COOLDOWN_MS);
  };

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  const enableLogin = config?.theme?.chatWindow?.enableLogin ?? false;
  const primaryColor =
    config?.theme?.chatWindow?.header?.backgroundColor || "#0096a2";

  return (
    <div
      className="mimin:relative mimin:flex mimin:flex-1 mimin:flex-col mimin:items-center mimin:justify-center mimin:overflow-hidden"
      style={{
        backgroundColor: primaryColor,
        backgroundImage: `linear-gradient(to bottom, ${primaryColor}, ${primaryColor}dd)`,
      }}
    >
      {!phoneOrIP ? (
        <div className="mimin:flex mimin:items-center mimin:gap-3 mimin:text-white">
          <LoaderCircle className="mimin:w-6 mimin:h-6 mimin:animate-spin" />
          <p className="mimin:text-lg mimin:font-medium">Loading...</p>
        </div>
      ) : (
        <React.Fragment>
          {enableLogin && isAuthenticated && (
            <button
              type="button"
              onClick={onLogout}
              title="Logout"
              className="mimin:absolute mimin:top-6 mimin:right-6 mimin:z-10 mimin:flex mimin:items-center mimin:gap-1.5 mimin:px-3.5 mimin:py-1.5 mimin:rounded-full mimin:bg-white/10 mimin:hover:bg-white/20 mimin:border mimin:border-white/20 mimin:text-white mimin:text-xs mimin:font-medium mimin:transition-colors mimin:cursor-pointer"
            >
              <LogOut className="mimin:w-3.5 mimin:h-3.5" />
              Logout
            </button>
          )}

          {enableLogin && !isAuthenticated ? (
            <div className="mimin:z-10 mimin:w-full mimin:p-4">
              <AuthWindow
                onSuccessLogin={onSuccessLogin}
                token=""
                sessionExpired={sessionExpired}
              />
            </div>
          ) : (
            <div className="mimin:flex mimin:flex-col mimin:items-center mimin:text-white mimin:text-center mimin:px-4">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h1 className="mimin:text-2xl mimin:font-bold mimin:mb-3">
                  {config?.theme?.chatWindow?.header?.title || "AI Voice Assistant"}
                </h1>
                <p className="mimin:opacity-80 mimin:mb-10 mimin:max-w-xs mimin:text-sm">
                  {config?.theme?.chatWindow?.header?.description ||
                    "Ready to assist you via voice. Click the button below to start a call."}
                </p>
              </motion.div>

              <div className="mimin:relative">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="mimin:absolute mimin:inset-0 mimin:bg-white/20 mimin:rounded-full"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: [1, 2, 2.5], opacity: [0.5, 0.2, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 3,
                      ease: "easeOut",
                      delay: i * 1,
                    }}
                  />
                ))}

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleStartCall}
                  disabled={isCallToggleLocked}
                  className="mimin:relative mimin:z-10 mimin:w-32 mimin:h-32 mimin:bg-white mimin:rounded-full mimin:flex mimin:items-center mimin:justify-center mimin:transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Phone className="mimin:w-14 mimin:h-14" style={{ color: primaryColor }} fill="currentColor" />
                </motion.button>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="mimin:mt-10"
              >
                <p className="mimin:text-xs mimin:font-semibold mimin:tracking-widest mimin:uppercase mimin:opacity-70 mimin:animate-pulse">
                  Tap To Initiate Call
                </p>
              </motion.div>
            </div>
          )}
        </React.Fragment>
      )}

      {isCallVisible && phoneOrIP && (
        <AgentVoiceLayout
          isVisible={isCallVisible}
          onToggleCallWindow={handleEndCall}
          phone={phoneOrIP.value}
          chatbotAgentId={storeConfig?.credentials?.voiceAgentId}
          voiceName={voiceName}
        />
      )}
    </div>
  );
};
