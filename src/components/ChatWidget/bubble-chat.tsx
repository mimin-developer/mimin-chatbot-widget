import React from "react";
import { createPortal } from "react-dom";
import { useConfigStore } from "../../hooks/config-store";
import { cn } from "../../utils";
import { format } from "date-fns";
import {
  Bot,
  CircleUserRound,
  Clock,
  AlertCircle,
  Check,
  RefreshCw,
  LoaderCircle,
  X,
  CornerUpLeft,
  Paperclip,
} from "lucide-react";
import DOMPurify from "dompurify";
import { processMessage, getMessageStyleVars } from "../../utils/message-parser";
import type { MediaItem } from "../../types";

const isImageFile = (url: string, type?: string) => {
  if (type === "image") return true;
  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.endsWith(".png") ||
    lowerUrl.endsWith(".jpg") ||
    lowerUrl.endsWith(".jpeg") ||
    lowerUrl.endsWith(".gif") ||
    lowerUrl.endsWith(".webp") ||
    lowerUrl.endsWith(".bmp") ||
    lowerUrl.endsWith(".svg")
  );
};

const isVideoType = (url: string, type?: string) =>
  type === "video" || /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(url);

const isAudioType = (url: string, type?: string) =>
  type === "audio" || /\.(mp3|wav|ogg|m4a|aac|flac|weba)(\?|$)/i.test(url);

const MediaItemRenderer: React.FC<{ item: MediaItem; isUser: boolean }> = ({ item, isUser }) => {
  const [imageError, setImageError] = React.useState(false);
  const [isZoomed, setIsZoomed] = React.useState(false);
  const { config } = useConfigStore();
  const isImg = isImageFile(item.data, item.type) && !imageError;

  if (isImg) {
    return (
      <>
        <div
          className="mimin:max-w-full mimin:rounded-lg mimin:overflow-hidden mimin:border mimin:border-gray-100 mimin:bg-white mimin:cursor-zoom-in mimin:hover:opacity-95 mimin:transition-opacity"
          onClick={() => setIsZoomed(true)}
        >
          <img
            src={item.data}
            alt={item.name || "Image"}
            className="mimin:max-w-full mimin:h-auto mimin:object-contain mimin:block mimin:min-w-[120px] mimin:min-h-[80px]"
            style={{ maxHeight: "200px" }}
            onError={() => setImageError(true)}
          />
        </div>

        {isZoomed && createPortal(
          <div
            className="mimin:fixed mimin:inset-0 mimin:z-[99999] mimin:flex mimin:flex-col mimin:items-center mimin:justify-center mimin:bg-black/80 mimin:p-8 mimin:cursor-zoom-out"
            onClick={() => setIsZoomed(false)}
          >
            <div className="mimin:relative mimin:flex mimin:items-center mimin:justify-center">
              <img
                src={item.data}
                alt={item.name || "Zoomed Image"}
                className="mimin:w-[90vw] mimin:max-w-[90vw] mimin:h-auto mimin:max-h-[90vh] mimin:object-contain mimin:rounded-lg mimin:shadow-2xl mimin:select-none"
              />
              <button
                type="button"
                className="mimin:fixed mimin:top-4 mimin:right-4 mimin:p-2.5 mimin:rounded-full mimin:bg-black/50 mimin:hover:bg-black/80 mimin:text-white mimin:cursor-pointer mimin:transition-colors mimin:z-[100000]"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsZoomed(false);
                }}
              >
                <X className="mimin:w-6 mimin:h-6" />
              </button>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  if (isVideoType(item.data, item.type)) {
    return (
      <video
        src={item.data}
        controls
        className="mimin:max-w-full mimin:rounded-lg mimin:h-auto mimin:max-h-[200px] mimin:bg-black"
      />
    );
  }

  if (isAudioType(item.data, item.type)) {
    return (
      <audio src={item.data} controls className="mimin:w-full mimin:max-w-[210px]" />
    );
  }

  const buttonColor = isUser
    ? "#ffffff"
    : config?.theme?.chatWindow?.botMessage?.textColor || "#0096a2";

  return (
    <div className="mimin:flex mimin:items-center mimin:gap-2 mimin:p-2 mimin:rounded-lg mimin:border mimin:bg-gray-50 mimin:text-gray-800 mimin:w-full mimin:max-w-[210px]">
      <span className="mimin:text-[9px] mimin:font-bold mimin:uppercase mimin:bg-gray-200 mimin:text-gray-600 mimin:px-1.5 mimin:py-0.5 mimin:rounded">
        {item.type || "FILE"}
      </span>
      <div className="mimin:flex-1 mimin:min-w-0">
        <p className="mimin:text-xs mimin:font-medium mimin:truncate mimin:text-gray-700">
          {item.name || "File"}
        </p>
      </div>
      <a
        href={item.data}
        target="_blank"
        rel="noopener noreferrer"
        className="mimin:text-xs mimin:hover:underline mimin:font-semibold"
        style={{ color: buttonColor }}
      >
        Open
      </a>
    </div>
  );
};

interface BubbleChatProps {
  message?: string;
  media?: MediaItem[];
  isUser?: boolean;
  thinking?: boolean;
  date: string | Date;
  isError?: boolean;
  status?: "pending" | "sending" | "sent" | "failed";
  isUploading?: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
  onReply?: () => void;
  context?: {
    id: string;
    direction: "incoming" | "outgoing";
    text: string;
    file: string;
    file_name: string;
  };
}

const HIGHLIGHT_CLASSES = [
  "mimin:ring-2",
  "mimin:ring-cyan-500",
  "mimin:ring-offset-1",
  "mimin:scale-[1.02]",
];

const BubbleChat: React.FC<BubbleChatProps> = ({
  message,
  media,
  isUser = false,
  thinking = false,
  date,
  isError = false,
  status,
  isUploading = false,
  onRetry,
  onCancel,
  onReply,
  context,
}) => {
  const { config } = useConfigStore();

  if (thinking) {
    return (
      <div
        className={cn(
          "mimin:relative mimin:flex mimin:w-fit mimin:max-w-[90%] mimin:border mimin:rounded-t-xl mimin:py-2 mimin:px-2.5 mimin:rounded-br-xl mimin:bg-white mimin:text-[#0096a2] mimin:border-[#0096a2] mimin:mr-auto mimin:justify-start"
        )}
        style={{
          backgroundColor:
            config?.theme?.chatWindow?.botMessage?.backgroundColor || "#ffffff",
          borderColor:
            config?.theme?.chatWindow?.botMessage?.borderColor || "#0096a2",
        }}
      >
        <div
          className="mimin:text-sm"
          style={{
            color:
              config?.theme?.chatWindow?.botMessage?.textColor || "#0096a2",
          }}
        >
          <div className="mimin:flex mimin:gap-3">
            <div className="mimin:text-base mimin:flex mimin:gap-2 mimin:items-end">
              {Array.from({ length: 3 }).map((_, index) => (
                <span
                  key={`loading-circle-${index}`}
                  className="mimin:block mimin:w-2 mimin:h-2 mimin:rounded-full mimin:bg-[#0096a2] mimin:animate-bounce"
                  style={{ animationDelay: `${250 * index}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasMedia = media && media.length > 0;
  const isMediaBubble = hasMedia || isUploading;
  if (!message && !hasMedia && !isUploading) {
    return null;
  }

  const isFailed = isError || status === "failed";
  const isPending = status === "pending" || isUploading;

  const StatusIcon = () => {
    if (isUploading) {
      return <LoaderCircle className="mimin:h-3 mimin:w-3 mimin:animate-spin mimin:text-gray-400" />;
    }
    if (isPending) {
      return <Clock className="mimin:h-3 mimin:w-3 mimin:text-gray-400" />;
    }
    if (isFailed) {
      return <AlertCircle className="mimin:h-3 mimin:w-3 mimin:text-red-500" />;
    }
    return <Check className="mimin:h-3 mimin:w-3 mimin:text-gray-500" />;
  };

  const userBgColor = isFailed
    ? "#DC2626"
    : isUser
      ? config?.theme?.chatWindow?.userMessage?.backgroundColor || "#0096a2"
      : config?.theme?.chatWindow?.botMessage?.backgroundColor || "#ffffff";

  const userTextColor = isFailed
    ? "#ffffff"
    : isUser
      ? config?.theme?.chatWindow?.userMessage?.textColor || "#ffffff"
      : config?.theme?.chatWindow?.botMessage?.textColor || "#0096a2";

  const handleContextClick = () => {
    if (!context) return;
    const element = document.getElementById(`msg-${context.id}`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    const bubble = element.querySelector(".message-bubble-content");
    if (bubble) {
      bubble.classList.add(...HIGHLIGHT_CLASSES);
      setTimeout(() => {
        bubble.classList.remove(...HIGHLIGHT_CLASSES);
      }, 1500);
    }
  };

  return (
    <div
      className={cn(
        "mimin:flex mimin:items-end mimin:gap-1.5" +
          (isUser ? " mimin:flex-row-reverse" : " mimin:flex-row")
      )}
    >
      <div
        className="mimin:flex mimin:items-center mimin:justify-center mimin:w-6 mimin:h-6 mimin:rounded-full mimin:shrink-0"
        style={{ backgroundColor: userBgColor }}
      >
        {isUser ? (
          <CircleUserRound
            className="mimin:w-3.5 mimin:h-3.5 mimin:aspect-square"
            color={userTextColor}
          />
        ) : config?.theme?.chatWindow?.header?.avatarSrc ? (
          <img
            src={config.theme.chatWindow.header.avatarSrc}
            alt=""
            className="mimin:w-3.5 mimin:h-3.5 mimin:rounded-full"
          />
        ) : (
          <Bot
            className="mimin:w-3.5 mimin:h-3.5 mimin:aspect-square"
            color={userTextColor}
          />
        )}
      </div>
      <div
        className={cn(
          "mimin:relative message-bubble-content mimin:flex mimin:min-w-0 mimin:border mimin:rounded-t-xl mimin:py-2 mimin:px-2.5 mimin:transition-all mimin:duration-300" +
            (isMediaBubble
              ? " mimin:w-[220px] mimin:max-w-[calc(100%-6rem)]"
              : " mimin:w-fit mimin:max-w-[calc(100%-6rem)]") +
            (!isUser
              ? " mimin:rounded-br-xl mimin:mr-auto mimin:justify-start"
              : " mimin:rounded-bl-xl mimin:ml-auto mimin:justify-end") +
            (isPending ? " mimin:opacity-70" : "")
        )}
        style={{
          backgroundColor: userBgColor,
          borderColor: userBgColor,
        }}
      >
        {/* Cancel button (during upload) */}
        {isUploading && onCancel && (
          <button
            type="button"
            className="mimin:absolute mimin:-top-2 mimin:-right-2 mimin:z-10 mimin:flex mimin:h-6 mimin:w-6 mimin:items-center mimin:justify-center mimin:bg-white mimin:text-red-600 mimin:hover:bg-red-50 mimin:rounded-full mimin:shadow-md mimin:border mimin:border-red-200 mimin:transition-all mimin:cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            title="Cancel upload"
          >
            <X className="mimin:h-3.5 mimin:w-3.5" strokeWidth={3} />
          </button>
        )}

        {/* Retry button (on failure) */}
        {isFailed && onRetry && (
          <button
            type="button"
            className="mimin:absolute mimin:-top-2 mimin:-right-2 mimin:z-10 mimin:flex mimin:h-6 mimin:w-6 mimin:items-center mimin:justify-center mimin:bg-sky-100 mimin:text-sky-600 mimin:hover:bg-sky-200 mimin:hover:text-sky-700 mimin:rounded-full mimin:shadow-md mimin:border mimin:border-sky-300 mimin:transition-all mimin:cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            title="Retry"
          >
            <RefreshCw className="mimin:h-3.5 mimin:w-3.5" strokeWidth={3} />
          </button>
        )}

        {/* Reply button */}
        {onReply && !isUploading && !isFailed && !isPending && (
          <button
            type="button"
            className={cn(
              "mimin:absolute mimin:top-1/2 mimin:-translate-y-1/2 mimin:p-1.5 mimin:rounded-full mimin:bg-white mimin:hover:bg-gray-100 mimin:shadow mimin:border mimin:border-gray-200 mimin:transition-all mimin:text-gray-500 mimin:hover:text-gray-700 mimin:opacity-80 mimin:cursor-pointer" +
                (isUser ? " mimin:-left-9" : " mimin:-right-9")
            )}
            onClick={(e) => {
              e.stopPropagation();
              onReply();
            }}
            title="Reply"
          >
            <CornerUpLeft className="mimin:h-3.5 mimin:w-3.5" strokeWidth={2.5} />
          </button>
        )}

        <div
          className="mimin:text-sm mimin:flex-1 mimin:min-w-0 mimin:pb-2 mimin:leading-relaxed mimin:break-words"
          style={{ color: userTextColor }}
        >
          {/* Reply Context */}
          {context && (
            <div
              onClick={handleContextClick}
              className={cn(
                "mimin:mb-2.5 mimin:p-2 mimin:rounded mimin:text-xs mimin:border-l-4 mimin:flex mimin:flex-col mimin:gap-0.5 mimin:select-none mimin:cursor-pointer mimin:hover:opacity-80 mimin:transition-opacity" +
                  (isUser
                    ? " mimin:bg-white/10 mimin:border-white/40 mimin:text-white/90"
                    : " mimin:bg-black/5 mimin:border-gray-300 mimin:text-gray-700")
              )}
            >
              <div className="mimin:font-semibold mimin:text-[10px] mimin:tracking-wide mimin:uppercase mimin:opacity-75">
                {context.direction === "incoming"
                  ? "You"
                  : config?.theme?.chatWindow?.header?.title || "Bot"}
              </div>
              {context.text && (
                <div className="mimin:line-clamp-2 mimin:italic mimin:text-[11px] mimin:leading-snug">
                  {context.text}
                </div>
              )}
              {context.file && (
                <div className="mimin:flex mimin:items-center mimin:gap-1 mimin:mt-0.5 mimin:text-[10px] mimin:font-medium mimin:opacity-90">
                  <Paperclip className="mimin:h-3 mimin:w-3 mimin:shrink-0" />
                  <span className="mimin:truncate mimin:max-w-[150px]">
                    {context.file_name || "Attachment"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Upload progress bar */}
          {isUploading && (
            <div className="mimin:mb-2.5 mimin:flex mimin:items-center mimin:gap-2">
              <div className="mimin:h-1 mimin:w-full mimin:rounded-full mimin:bg-white/30 mimin:overflow-hidden mimin:flex-1">
                <div
                  className="mimin:h-full mimin:bg-current mimin:opacity-40"
                  style={{
                    width: "40%",
                    animation: "uploading-shimmer 1.5s ease-in-out infinite",
                  }}
                />
              </div>
            </div>
          )}

          {message && (
            <div
              style={getMessageStyleVars(isUser, config)}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(processMessage(message), {
                  ALLOWED_TAGS: ["a", "strong", "em", "code", "br"],
                  ALLOWED_ATTR: ["href", "target", "rel", "class"],
                }),
              }}
            />
          )}

          {media && media.length > 0 && (
            <div className="mimin:flex mimin:flex-col mimin:gap-2 mimin:mt-2">
              {media.map((item, index) => (
                <MediaItemRenderer key={index} item={item} isUser={isUser} />
              ))}
            </div>
          )}

          {isFailed && (
            <div className="mimin:mt-1 mimin:text-xs mimin:text-red-100 mimin:italic">
              Message failed to send
            </div>
          )}
        </div>

        {/* Status footer */}
        <div
          className={cn(
            "mimin:absolute mimin:top-full mimin:mt-0.5 mimin:flex mimin:items-center mimin:gap-1 mimin:w-max" +
              (isUser ? " mimin:right-0" : " mimin:left-0")
          )}
        >
          {!isUploading && (
            <p className="mimin:text-[10px] mimin:font-light mimin:text-gray-500 mimin:w-max">
              {format(new Date(date), "dd MMM yyyy, HH:mm")}
            </p>
          )}

          {isUser && (isPending || isFailed || status) && (
            <span className="mimin:flex mimin:items-center">
              <StatusIcon />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BubbleChat;
