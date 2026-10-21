import React from "react";
import { useConfigStore } from "../../hooks/config-store";
import FormSend, { type ReplyMessageInfo } from "./form-send";

interface ChatInputProps {
  onSendMessage: (
    message: string,
    media?: { type: string; name: string; data: string }[],
    replyToId?: string
  ) => void;
  onCancelSendMessage: () => void;
  loading: boolean;
  fetching: boolean;
  replyToMessage?: ReplyMessageInfo | null;
  onCancelReply?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onCancelSendMessage,
  loading,
  fetching,
  replyToMessage,
  onCancelReply,
}) => {
  const { config } = useConfigStore();

  return (
    <div
      className="mimin:px-2 mimin:py-2 mimin:max-h-full"
      style={{
        backgroundColor:
          config?.theme?.chatWindow?.textInput?.backgroundColor || "#0096a2",
        overflowAnchor: "none",
      }}
    >
      <FormSend
        onSendMessage={onSendMessage}
        onCancelSend={onCancelSendMessage}
        loading={loading}
        disabled={fetching}
        replyToMessage={replyToMessage}
        onCancelReply={onCancelReply}
      />
      <p
        className="mimin:text-[10px] mimin:tracking-wide mimin:text-center mimin:mt-1"
        style={{
          color:
            config?.theme?.chatWindow?.textInput?.footerTextColor || "#ffffff",
        }}
      >
        {config?.theme?.chatWindow?.textInput?.footerText ||
          "Ada yang bisa saya bantu?"}
      </p>
    </div>
  );
};
