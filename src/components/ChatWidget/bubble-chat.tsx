import React from "react";
import { createPortal } from "react-dom";
import { useConfigStore } from "../../hooks/config-store";
import { cn } from "../../utils";
import { format } from "date-fns";
import { Bot, CircleUserRound, X } from "lucide-react";

interface MediaItem {
  type: string;
  name: string;
  data: string;
}

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
            width={1000}
            height={1000}
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

  const buttonColor = isUser
    ? "#ffffff"
    : config?.theme?.chatWindow?.botMessage?.textColor || "#0096a2";

  return (
    <div
      className="mimin:flex mimin:items-center mimin:gap-2 mimin:p-2 mimin:rounded-lg mimin:border mimin:bg-gray-50 mimin:text-gray-800 mimin:w-full mimin:max-w-[210px]"
    >
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

const BubbleChat: React.FC<{
  message?: string;
  media?: MediaItem[];
  isUser?: boolean;
  thinking?: boolean;
  date: string | Date;
  isError?: boolean;
}> = ({ message, media, isUser = false, thinking = false, date, isError = false }) => {
  const { config } = useConfigStore();
  const processMessage = (message: string, isOwn: boolean) => {
    const userTextColor = config?.theme?.chatWindow?.userMessage?.textColor || "#ffffff";
    const botTextColor = config?.theme?.chatWindow?.botMessage?.textColor || "#0096a2";
    const linkColor = isOwn ? userTextColor : botTextColor;

    // Handle existing HTML tags first
    const htmlProcessed = message.replace(
      /<a href="([^"]+)"[^>]*>(.*?)<\/a>/g,
      `<a href="$1" target="_blank" style="color: ${linkColor}; text-decoration-line: underline; word-break: break-word; white-space: normal;" rel="noopener noreferrer">$2</a>`
    );

    // Replace *text* with <strong>text</strong>
    const boldProcessed = htmlProcessed.replace(
      /\*(.*?)\*/g,
      "<strong>$1</strong>"
    );

    // Replace _text_ with <em>text</em>
    const italicProcessed = boldProcessed.replace(
      /\_(.*?)\_/g,
      "<em>$1</em>"
    );

    const isUserDark = userTextColor.toLowerCase() === "#ffffff" || userTextColor.toLowerCase() === "#fff";
    const isBotDark = botTextColor.toLowerCase() === "#ffffff" || botTextColor.toLowerCase() === "#fff";

    const codeStyle = isOwn
      ? `background: ${isUserDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.06)"}; color: ${userTextColor}; border: 1px solid ${isUserDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.08)"};`
      : `background: ${isBotDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.05)"}; color: ${botTextColor}; border: 1px solid ${isBotDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.05)"};`;

    // Replace ```code``` or `code` with <code>code</code>
    const codeProcessed = italicProcessed.replace(
      /```([\s\S]*?)```|`([^`]+)`/g,
      (_, block, inline) => {
        const content = block || inline;
        const isBlock = !!block;
        const style = isBlock
          ? `${codeStyle} padding: 6px 10px; border-radius: 4px; font-size: 0.85em; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace; font-weight: 500; display: block; overflow-x: auto; white-space: pre-wrap; margin: 4px 0;`
          : `${codeStyle} padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace; font-weight: 500;`;
        return `<code style="${style}">${content}</code>`;
      }
    );

    // Replace [text](url) with <a href="url">text</a>
    const markdownLinkProcessed = codeProcessed.replace(
      /\[(.*?)\]\((https?:\/\/[^\s]+)\)/g,
      `<a href="$2" target="_blank" style="color: ${linkColor}; text-decoration-line: underline; word-break: break-word; white-space: normal;" rel="noopener noreferrer">$1</a>`
    );

    // Replace plain URLs with clickable links, avoiding already transformed markdown links
    const linkProcessed = markdownLinkProcessed.replace(
      /(?<!href=")https?:\/\/[^\s"]+/g,
      `<a href="$&" target="_blank" style="color: ${linkColor}; text-decoration-line: underline; word-break: break-word; white-space: normal;" rel="noopener noreferrer">$&</a>`
    );

    // Replace \n with <br>
    return linkProcessed.replace(/\n/g, "<br>");
  };

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
  if (!message && !hasMedia) {
    return null;
  }

  return (
    <div
      className={cn(
        "mimin:flex mimin:items-end mimin:gap-1.5" +
          (isUser ? " mimin:flex-row-reverse" : " mimin:flex-row")
      )}
    >
      <div
        className="mimin:flex mimin:items-center mimin:justify-center mimin:w-6 mimin:h-6 mimin:rounded-full mimin:shrink-0"
        style={{
          backgroundColor: isError
            ? "#DC2626"
            : isUser
              ? config?.theme?.chatWindow?.userMessage?.backgroundColor || "#0096a2"
              : config?.theme?.chatWindow?.botMessage?.backgroundColor || "#ffffff",
        }}
      >
        {isUser ? (
          <CircleUserRound
            className="mimin:w-3.5 mimin:h-3.5 mimin:aspect-square"
            color={
              config?.theme?.chatWindow?.userMessage?.textColor || "#ffffff"
            }
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
            color={
              config?.theme?.chatWindow?.botMessage?.textColor || "#0096a2"
            }
          />
        )}
      </div>
      <div
        className={cn(
          "mimin:relative mimin:flex mimin:w-fit mimin:max-w-[90%] mimin:border mimin:rounded-t-xl mimin:py-2 mimin:px-2.5" +
            (!isUser
              ? " mimin:rounded-br-xl mimin:bg-white mimin:text-[#0096a2] mimin:border-[#0096a2] mimin:mr-auto mimin:justify-start"
              : " mimin:rounded-bl-xl mimin:bg-white mimin:text-[#0096a2] mimin:border-[#0096a2] mimin:ml-auto mimin:justify-end")
        )}
        style={{
          backgroundColor: isError
            ? "#DC2626"
            : (isUser
                ? config?.theme?.chatWindow?.userMessage?.backgroundColor || "#0096a2"
                : config?.theme?.chatWindow?.botMessage?.backgroundColor || "#ffffff"),
          borderColor: isError
            ? "#DC2626"
            : (isUser
                ? config?.theme?.chatWindow?.userMessage?.borderColor || "#0096a2"
                : config?.theme?.chatWindow?.botMessage?.borderColor || "#0096a2"),
        }}
      >
        <div
          className="mimin:text-sm mimin:flex-1 mimin:pb-2"
          style={{
            color: isUser
              ? config?.theme?.chatWindow?.userMessage?.textColor || "#ffffff"
              : config?.theme?.chatWindow?.botMessage?.textColor || "#0096a2",
          }}
        >
          {message && (
            <div
              dangerouslySetInnerHTML={{
                __html: processMessage(message, isUser),
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
        </div>
        <div
          className={cn(
            "mimin:absolute mimin:top-full mimin:mt-0.5 mimin:w-fit" +
              (isUser ? " mimin:right-0" : " mimin:left-0")
          )}
        >
          <p className="mimin:text-[10px] mimin:font-light mimin:text-gray-500 mimin:w-max">
            {format(new Date(date), "dd MMMM yyyy, HH:mm")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BubbleChat;
