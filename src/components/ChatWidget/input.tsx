import React, { useRef, useState } from "react";
import { useConfigStore } from "../../hooks/config-store";
import { RiSendPlane2Fill } from "react-icons/ri";
import { FaCircleStop } from "react-icons/fa6";
import { Paperclip, X } from "lucide-react";
import { convertToBase64 } from "../../utils";

interface ChatInputProps {
  onSendMessage: (message: string, media?: { type: string; name: string; data: string }[]) => void;
  onCancelSendMessage: (message: string) => void;
  loading: boolean;
  fetching: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onCancelSendMessage,
  loading,
  fetching,
}) => {
  const [message, setMessage] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<{ type: string; name: string; data: string }[]>([]);
  const { config } = useConfigStore();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fungsi untuk auto resize
  const autoResize = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newMedia: { type: "image" | "video" | "audio" | "document"; name: string; data: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const base64Data = await convertToBase64(files[i]);
        newMedia.push(base64Data);
      } catch (error) {
        console.error("Failed to convert file to base64", error);
      }
    }

    setSelectedMedia((prev) => [...prev, ...newMedia]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSendMessage = () => {
    if (!fetching && !loading && (message.trim().length > 0 || selectedMedia.length > 0)) {
      onSendMessage(message, selectedMedia);
      setMessage("");
      setSelectedMedia([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  return (
    <div
      className="mimin:px-2 mimin:py-2 mimin:overflow-hidden mimin:max-h-full"
      style={{
        backgroundColor:
          config?.theme?.chatWindow?.textInput?.backgroundColor || "#0096a2",
        overflowAnchor: "none",
      }}
    >
      {/* Media Attachment Previews */}
      {selectedMedia.length > 0 && (
        <div className="mimin:flex mimin:flex-wrap mimin:gap-2 mimin:mb-2 mimin:p-1.5 mimin:bg-white/10 mimin:rounded-md">
          {selectedMedia.map((mediaItem, idx) => (
            <div
              key={idx}
              className="mimin:relative mimin:flex mimin:items-center mimin:gap-1.5 mimin:p-1 mimin:bg-white mimin:rounded-md mimin:border mimin:border-gray-200 mimin:max-w-[150px]"
            >
              {mediaItem.type === "image" ? (
                <img
                  src={mediaItem.data}
                  alt="preview"
                  className="mimin:w-8 mimin:h-8 mimin:object-cover mimin:rounded"
                />
              ) : (
                <div className="mimin:w-8 mimin:h-8 mimin:bg-gray-100 mimin:flex mimin:items-center mimin:justify-center mimin:rounded mimin:text-[8px] mimin:font-bold mimin:text-gray-500">
                  {mediaItem.type.substring(0, 3).toUpperCase()}
                </div>
              )}
              <span className="mimin:text-[10px] mimin:truncate mimin:text-gray-700 mimin:flex-1">
                {mediaItem.name}
              </span>
              <button
                type="button"
                className="mimin:p-0.5 mimin:rounded-full mimin:bg-red-100 mimin:text-red-600 hover:mimin:bg-red-200 mimin:cursor-pointer"
                onClick={() => setSelectedMedia((prev) => prev.filter((_, i) => i !== idx))}
              >
                <X className="mimin:w-3 mimin:h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (loading) {
            onCancelSendMessage(message);
          } else {
            handleSendMessage();
          }
        }}
        className="mimin:relative mimin:flex mimin:items-center mimin:gap-2"
      >
        {config?.theme?.chatWindow?.enableMediaUpload && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="mimin:hidden"
              multiple
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mimin:p-2 mimin:rounded-md mimin:bg-white/20 hover:mimin:bg-white/30 mimin:text-white mimin:cursor-pointer mimin:transition-colors"
              style={{
                height: "38px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Paperclip className="mimin:w-5 mimin:h-5" />
            </button>
          </>
        )}

        <textarea
          className="mimin:flex-1 mimin:border mimin:rounded-md mimin:p-2 mimin:max-h-[80px] mimin:bg-white mimin:text-black mimin:pr-10 mimin:focus:outline mimin:focus:outline-[#ffa100] mimin:resize-none"
          style={{
            borderColor:
              config?.theme?.chatWindow?.textInput?.borderColor || "#ffffff",
          }}
          placeholder={
            config?.theme?.chatWindow?.textInput?.placeholder ||
            "Ketik pertanyaan Anda..."
          }
          rows={1}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (loading) {
                onCancelSendMessage(message);
              } else {
                handleSendMessage();
              }
            }
          }}
          onInput={autoResize}
          ref={textareaRef}
        />
        <button
          className="mimin:absolute mimin:right-4 mimin:top-1/2 -mimin:translate-y-1/2 mimin:cursor-pointer disabled:mimin:opacity-50 disabled:mimin:cursor-not-allowed"
          disabled={message.trim().length === 0 && selectedMedia.length === 0 && !loading}
          style={{
            color:
              config?.theme?.chatWindow?.textInput?.sendButtonColor ||
              "#0096a2",
          }}
        >
          {loading ? (
            <FaCircleStop className="mimin:w-4 mimin:h-4" />
          ) : (
            <RiSendPlane2Fill className="mimin:w-4 mimin:h-4" />
          )}
        </button>
      </form>
      <p
        className="mimin:text-[10px] mimin:tracking-wide mimin:text-center mimin:mt-1"
        style={{
          color:
            config?.theme?.chatWindow?.textInput?.footerTextColor || "$ffffff",
        }}
      >
        {config?.theme?.chatWindow?.textInput?.footerText ||
          "Ada yang bisa saya bantu?"}
      </p>
    </div>
  );
};
