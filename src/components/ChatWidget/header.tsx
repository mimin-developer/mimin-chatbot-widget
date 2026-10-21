import React from "react";
import { X, LogOut, Bot } from "lucide-react";
import { useConfigStore } from "../../hooks/config-store";
import { MdPhone } from "react-icons/md";

interface ChatHeaderProps {
  onToggleCallWindow?: () => void;
  onToggleChatWindow?: () => void;
  onLogout?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleCallWindow,
  onToggleChatWindow,
  onLogout,
}) => {
  const { config } = useConfigStore();
  return (
    <div
      className="mimin:flex mimin:items-center mimin:justify-between mimin:gap-2 mimin:px-4 mimin:py-2"
      style={{
        backgroundColor:
          config?.theme?.chatWindow?.header?.backgroundColor || "#0096a2",
      }}
    >
      <div className="mimin:flex mimin:items-center mimin:gap-3">
        <div className="mimin:flex mimin:items-center mimin:justify-center mimin:w-9 mimin:h-9 mimin:rounded-full mimin:bg-white">
          {config?.theme?.chatWindow?.header?.avatarSrc ? (
            <img
              src={config.theme.chatWindow.header.avatarSrc}
              alt=" "
              className="mimin:w-6 mimin:h-6 mimin:rounded-full"
            />
          ) : (
            <Bot
              className="mimin:w-5 mimin:h-5"
              color={
                config?.theme?.chatWindow?.header?.backgroundColor || "#0096a2"
              }
            />
          )}
        </div>
        <div className="mimin:flex-1">
          <h3
            className="mimin:text-base mimin:font-bold"
            style={{
              color: config?.theme?.chatWindow?.header?.color || "#ffffff",
            }}
          >
            {config?.theme?.chatWindow?.header?.title || "MINA"}
          </h3>
          <p
            className="mimin:text-white mimin:font-light mimin:text-[9px]"
            style={{
              color: config?.theme?.chatWindow?.header?.color || "#ffffff",
            }}
          >
            {config?.theme?.chatWindow?.header?.description ||
              "Ngobrol langsung dengan AI, cepat & mudah."}
          </p>
        </div>
      </div>
      <div className="mimin:flex mimin:items-center mimin:gap-4">
        {(config?.data?.enable_voice ??
          config?.theme?.chatWindow?.isActiveCall) &&
          onToggleCallWindow && (
            <button
              style={{
                color:
                  config?.theme?.chatWindow?.header?.voiceAIColorButton ||
                  "#ffffff",
              }}
              className="mimin:relative mimin:cursor-pointer mimin:disabled:opacity-50 mimin:disabled:cursor-not-allowed"
              onClick={onToggleCallWindow}
            >
              <MdPhone
                className="mimin:w-5 mimin:h-5"
                color={
                  config?.theme?.chatWindow?.header?.voiceAIColorButton ||
                  "#ffffff"
                }
              />
              <div className="mimin:absolute mimin:-top-0 mimin:-right-0">
                <p className="mimin:text-[8px] mimin:font-medium">AI</p>
              </div>
            </button>
          )}
        {onLogout && (
          <button
            className="mimin:cursor-pointer mimin:disabled:opacity-50 mimin:disabled:cursor-not-allowed"
            style={{
              color:
                config?.theme?.chatWindow?.header?.closeColorButton || "#ffffff",
            }}
            title="Logout"
            onClick={onLogout}
          >
            <LogOut
              className="mimin:w-5 mimin:h-5"
              color={
                config?.theme?.chatWindow?.header?.closeColorButton || "#ffffff"
              }
            />
          </button>
        )}
        {onToggleChatWindow && (
          <button
            className="mimin:cursor-pointer mimin:disabled:opacity-50 mimin:disabled:cursor-not-allowed"
            style={{
              color: config?.theme?.chatWindow?.header?.closeColorButton || "#ffffff",
            }}
            onClick={onToggleChatWindow}
          >
            <X
              className="mimin:w-5 mimin:h-5"
              color={config?.theme?.chatWindow?.header?.closeColorButton || "#ffffff"}
            />
          </button>
        )}
      </div>
    </div>
  );
};
