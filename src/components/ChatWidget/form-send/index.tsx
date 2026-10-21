import {
  useState,
  useRef,
  useEffect,
  useMemo,
} from "react";
import type { FormEvent } from "react";
import { IoSend } from "react-icons/io5";
import { FaCircleStop } from "react-icons/fa6";
import {
  Bold,
  Italic,
  Code,
  SmilePlus,
  Paperclip,
  LoaderCircle,
  X,
  CornerUpLeft,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
} from "lucide-react";
import { cn } from "../../../utils";
import { useConfigStore } from "../../../hooks/config-store";
import EmojiPicker from "./emoji-picker";
import FormSettingModal from "./form-setting-modal";
import { useFormSettingStore } from "../../../hooks/use-form-setting-store";

const MAX_CHARS = 1024;
const MAX_FILES = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export interface SelectedFileItem {
  id: string;
  type: "image" | "video" | "audio" | "document";
  name: string;
  data: string;
  file?: File;
}

export interface ReplyMessageInfo {
  id: string;
  text: string;
  sender: string;
  file_name?: string;
}

const convertFileToBase64 = (
  file: File
): Promise<SelectedFileItem> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const mime = file.type || "";
      const type = mime.startsWith("image/")
        ? "image"
        : mime.startsWith("video/")
          ? "video"
          : mime.startsWith("audio/")
            ? "audio"
            : "document";

      resolve({
        id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        type,
        name: file.name,
        data: reader.result as string,
        file,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileTypeIcon(type: string) {
  switch (type) {
    case "image":
      return <ImageIcon className="mimin:w-5 mimin:h-5 mimin:text-blue-500" />;
    case "video":
      return <Video className="mimin:w-5 mimin:h-5 mimin:text-purple-500" />;
    case "audio":
      return <Music className="mimin:w-5 mimin:h-5 mimin:text-green-500" />;
    default:
      return <FileText className="mimin:w-5 mimin:h-5 mimin:text-gray-500" />;
  }
}

interface FormSendProps {
  onSendMessage: (
    message: string,
    media?: { type: string; name: string; data: string }[],
    replyToId?: string
  ) => void;
  onCancelSend: () => void;
  loading: boolean;
  disabled: boolean;
  replyToMessage?: ReplyMessageInfo | null;
  onCancelReply?: () => void;
}

function FormSend({
  onSendMessage,
  onCancelSend,
  loading,
  disabled,
  replyToMessage,
  onCancelReply,
}: FormSendProps) {
  const { config } = useConfigStore();
  const [message, setMessage] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<SelectedFileItem[]>([]);
  const [activeFormats, setActiveFormats] = useState<{
    bold: boolean;
    italic: boolean;
    monospace: boolean;
  }>({
    bold: false,
    italic: false,
    monospace: false,
  });
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [processingMedia, setProcessingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { getSetting } = useFormSettingStore();

  const showMediaError = (text: string) => {
    setMediaError(text);
    if (mediaErrorTimerRef.current) {
      clearTimeout(mediaErrorTimerRef.current);
    }
    mediaErrorTimerRef.current = setTimeout(() => setMediaError(null), 3500);
  };

  useEffect(() => {
    return () => {
      if (mediaErrorTimerRef.current) {
        clearTimeout(mediaErrorTimerRef.current);
      }
    };
  }, []);

  const configColors = config?.theme?.chatWindow?.textInput;
  const primaryColor = configColors?.sendButtonColor || "#0096a2";
  const footerTextColor = configColors?.footerTextColor || "#ffffff";
  const hoverBgColor = useMemo(() => {
    if (!footerTextColor) return "rgba(255, 255, 255, 0.3)";
    if (footerTextColor.startsWith("#")) {
      if (footerTextColor.length === 4) {
        const r = footerTextColor[1];
        const g = footerTextColor[2];
        const b = footerTextColor[3];
        return `#${r}${r}${g}${g}${b}${b}4d`;
      }
      return footerTextColor.slice(0, 7) + "4d";
    }
    if (footerTextColor.startsWith("rgb")) {
      if (footerTextColor.startsWith("rgba")) {
        return footerTextColor.replace(/[\d\.]+\)$/, "0.3)");
      }
      return footerTextColor.replace("rgb", "rgba").replace(")", ", 0.3)");
    }
    return footerTextColor;
  }, [footerTextColor]) as string;

  const getSelectedText = () => {
    const textarea = textareaRef.current;
    if (!textarea) return { text: "", start: 0, end: 0 };
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    return { text: textarea.value.substring(start, end), start, end };
  };

  const replaceSelectedText = (newText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { start, end } = getSelectedText();
    const beforeText = message.substring(0, start);
    const afterText = message.substring(end);
    const newMessage = beforeText + newText + afterText;
    setMessage(newMessage);
    setTimeout(() => {
      if (textarea) {
        const newCursorPos = start + newText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }
    }, 0);
  };

  const toggleFormat = (format: "bold" | "italic" | "monospace") => {
    const { text, start, end } = getSelectedText();
    if (text) {
      let formattedText = "";
      switch (format) {
        case "bold":
          formattedText = `*${text}*`;
          break;
        case "italic":
          formattedText = `_${text}_`;
          break;
        case "monospace":
          formattedText = `\`\`\`${text}\`\`\``;
          break;
      }
      replaceSelectedText(formattedText);
    } else {
      setActiveFormats((prev) => ({
        ...prev,
        [format]: !prev[format],
      }));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    if (selectedMedia.length + fileArray.length > MAX_FILES) {
      showMediaError(`Maximum ${MAX_FILES} files allowed`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const validFiles: File[] = [];
    for (const file of fileArray) {
      if (file.size > MAX_FILE_SIZE) {
        showMediaError(`File "${file.name}" exceeds the 25 MB limit`);
        continue;
      }
      validFiles.push(file);
    }

    setProcessingMedia(true);
    try {
      const converted = await Promise.all(validFiles.map(convertFileToBase64));
      setSelectedMedia((prev) => [...prev, ...converted]);
    } catch {
      showMediaError("Failed to process files");
    } finally {
      setProcessingMedia(false);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (id: string) => {
    setSelectedMedia((prev) => prev.filter((f) => f.id !== id));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (disabled || loading) return;
    if (!config?.theme?.chatWindow?.enableMediaUpload) return;
    const items = e.clipboardData.items;
    const pastedFiles: File[] = [];
    let hasFile = false;

    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        hasFile = true;
        const file = items[i].getAsFile();
        if (file) {
          const isPastedImage =
            file.type.startsWith("image/") &&
            (!file.name || /^(image|gambar|screenshot|paste)/i.test(file.name));
          if (isPastedImage) {
            const ext = file.type.split("/")[1] || "png";
            const renamedFile = new File(
              [file],
              `pasted-image-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`,
              { type: file.type }
            );
            pastedFiles.push(renamedFile);
          } else {
            pastedFiles.push(file);
          }
        }
      }
    }

    if (hasFile) {
      e.preventDefault();
      if (pastedFiles.length > 0) {
        if (selectedMedia.length + pastedFiles.length > MAX_FILES) {
          showMediaError(`Maximum ${MAX_FILES} files allowed`);
          return;
        }
        const oversized = pastedFiles.filter((f) => f.size > MAX_FILE_SIZE);
        if (oversized.length > 0) {
          showMediaError(`File "${oversized[0].name}" exceeds the 25 MB limit`);
          return;
        }
        setProcessingMedia(true);
        Promise.all(pastedFiles.map(convertFileToBase64))
          .then((converted) => {
            setSelectedMedia((prev) => [...prev, ...converted]);
          })
          .catch(() => showMediaError("Failed to process pasted files"))
          .finally(() => setProcessingMedia(false));
      }
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    if (disabled || loading) return;
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const cursorPosition = textarea.selectionStart || 0;
      const textBefore = message.substring(0, cursorPosition);
      const textAfter = message.substring(cursorPosition);
      const newMessage = textBefore + emoji + textAfter;
      setMessage(newMessage);
      setTimeout(() => {
        const newCursorPos = cursorPosition + emoji.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }
  };

  const handleSend = (e?: FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (loading) {
      onCancelSend();
      return;
    }

    const text = message.trim();
    const hasText = text.length > 0;
    const hasMedia = selectedMedia.length > 0;

    if (!hasText && !hasMedia) return;

    const mediaPayload = selectedMedia.map((m) => ({
      type: m.type,
      name: m.name,
      data: m.data,
    }));

    onSendMessage(text, hasMedia ? mediaPayload : undefined, replyToMessage?.id);
    setMessage("");
    setSelectedMedia([]);
    setActiveFormats({ bold: false, italic: false, monospace: false });
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key !== "Enter") {
      switch (e.key.toLowerCase()) {
        case "b":
          e.preventDefault();
          toggleFormat("bold");
          break;
        case "i":
          e.preventDefault();
          toggleFormat("italic");
          break;
        case "m":
          e.preventDefault();
          toggleFormat("monospace");
          break;
        case "e":
          e.preventDefault();
          setIsEmojiPickerOpen((prev) => !prev);
          break;
      }
      return;
    }

    if (e.key === "Enter") {
      if (e.shiftKey) return;

      if (getSetting("shortcut-enter") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleSend();
        return;
      }

      if (getSetting("shortcut-ctrl-enter") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
        return;
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (disabled || loading) return;
    const value = e.target.value;
    if (value.length > MAX_CHARS) return;
    setMessage(value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [message]);

  useEffect(() => {
    if (!isEmojiPickerOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const emojiPicker = target.closest("[data-emoji-picker]");
      const emojiButton = target.closest("[data-emoji-button]");
      if (!emojiPicker && !emojiButton) {
        setIsEmojiPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEmojiPickerOpen]);

  const canSend = message.trim().length > 0 || selectedMedia.length > 0;

  return (
    <form onSubmit={handleSend} className="mimin:relative">
      {processingMedia && (
        <div className="mimin:absolute mimin:inset-0 mimin:bg-white/60 mimin:backdrop-blur-sm mimin:z-50 mimin:flex mimin:items-center mimin:justify-center mimin:rounded-lg">
          <div className="mimin:flex mimin:items-center mimin:gap-2">
            <LoaderCircle className="mimin:w-5 mimin:h-5 mimin:animate-spin mimin:text-gray-500" />
            <span className="mimin:text-sm mimin:text-gray-500">
              Processing...
            </span>
          </div>
        </div>
      )}

      {mediaError && (
        <div className="mimin:mb-2 mimin:px-3 mimin:py-2 mimin:rounded-lg mimin:bg-red-500/90 mimin:text-white mimin:text-xs mimin:flex mimin:items-center mimin:justify-between mimin:gap-2">
          <span>{mediaError}</span>
          <button
            type="button"
            className="mimin:p-0.5 mimin:rounded-full mimin:hover:bg-white/20 mimin:cursor-pointer"
            onClick={() => setMediaError(null)}
          >
            <X className="mimin:w-3 mimin:h-3" />
          </button>
        </div>
      )}

      {selectedMedia.length > 0 && (
        <div className="mimin:grid mimin:grid-cols-2 mimin:gap-2 mimin:mb-2">
          {selectedMedia.map((file) => (
            <div
              key={file.id}
              className="mimin:w-full mimin:min-w-0 mimin:overflow-hidden mimin:flex mimin:items-center mimin:justify-between mimin:gap-2 mimin:rounded-lg mimin:border mimin:p-2 mimin:pr-3"
              style={{
                backgroundColor:
                  footerTextColor || "rgba(255,255,255,0.95)",
                borderColor: "rgba(255,255,255,0.3)",
              }}
            >
              <div className="mimin:flex-1 mimin:min-w-0 mimin:flex mimin:items-center mimin:gap-3">
                <div
                  className="mimin:bg-white mimin:flex mimin:aspect-square mimin:w-10 mimin:h-10 mimin:shrink-0 mimin:items-center mimin:justify-center mimin:rounded mimin:border mimin:border-gray-200 mimin:overflow-hidden"
                >
                  {file.type === "image" ? (
                    <img
                      src={file.data}
                      alt={file.name}
                      className="mimin:w-full mimin:h-full mimin:object-cover"
                    />
                  ) : (
                    getFileTypeIcon(file.type)
                  )}
                </div>

                <div className="mimin:flex-1 mimin:min-w-0 mimin:flex mimin:flex-col mimin:gap-0.5">
                  <p
                    className="mimin:text-xs mimin:font-medium mimin:truncate"
                    style={{ color: configColors?.backgroundColor || "#333" }}
                  >
                    {file.name}
                  </p>
                  {file.file && (
                    <p
                      className="mimin:text-[10px] mimin:opacity-70"
                      style={{ color: configColors?.backgroundColor || "#666" }}
                    >
                      {formatBytes(file.file.size)}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="mimin:flex mimin:h-5 mimin:w-5 mimin:shrink-0 mimin:items-center mimin:justify-center mimin:rounded-full mimin:hover:bg-black/10 mimin:cursor-pointer"
                style={{ color: configColors?.backgroundColor || "#666" }}
                onClick={() => removeFile(file.id)}
                aria-label="Remove file"
              >
                <X className="mimin:w-4 mimin:h-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mimin:flex mimin:items-center mimin:gap-1 mimin:mb-1.5 mimin:flex-wrap">
        <FormSettingModal disabled={disabled || loading} />
        <div className="mimin:h-5 mimin:w-px mimin:bg-gray-300 mimin:mx-1" />
        <button
          type="button"
          className={cn(
            "mimin:w-7 mimin:h-7 mimin:rounded-full mimin:flex mimin:items-center mimin:justify-center mimin:cursor-pointer",
            (disabled || loading) && "mimin:opacity-50"
          )}
          style={{
            backgroundColor: activeFormats.bold ? hoverBgColor : undefined,
          }}
          disabled={disabled || loading}
          onClick={() => toggleFormat("bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold className="mimin:w-3.5 mimin:h-3.5" color={footerTextColor} />
        </button>
        <button
          type="button"
          className={cn(
            "mimin:w-7 mimin:h-7 mimin:rounded-full mimin:flex mimin:items-center mimin:justify-center mimin:cursor-pointer",
            (disabled || loading) && "mimin:opacity-50"
          )}
          style={{
            backgroundColor: activeFormats.italic ? hoverBgColor : undefined,
          }}
          disabled={disabled || loading}
          onClick={() => toggleFormat("italic")}
          title="Italic (Ctrl+I)"
        >
          <Italic className="mimin:w-3.5 mimin:h-3.5" color={footerTextColor} />
        </button>
        <button
          type="button"
          className={cn(
            "mimin:w-7 mimin:h-7 mimin:rounded-full mimin:flex mimin:items-center mimin:justify-center mimin:cursor-pointer",
            (disabled || loading) && "mimin:opacity-50"
          )}
          style={{
            backgroundColor: activeFormats.monospace ? hoverBgColor : undefined,
          }}
          disabled={disabled || loading}
          onClick={() => toggleFormat("monospace")}
          title="Code (Ctrl+M)"
        >
          <Code className="mimin:w-3.5 mimin:h-3.5" color={footerTextColor} />
        </button>
        <button
          type="button"
          data-emoji-button
          className={cn(
            "mimin:w-7 mimin:h-7 mimin:rounded-full mimin:flex mimin:items-center mimin:justify-center mimin:cursor-pointer",
            (disabled || loading) && "mimin:opacity-50"
          )}
          style={{
            backgroundColor: isEmojiPickerOpen ? hoverBgColor : undefined,
          }}
          disabled={disabled || loading}
          onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
          title="Emoji (Ctrl+E)"
        >
          <SmilePlus
            className="mimin:w-3.5 mimin:h-3.5"
            color={footerTextColor}
          />
        </button>
        <div className="mimin:h-5 mimin:w-px mimin:bg-gray-300 mimin:mx-1" />
        {config?.theme?.chatWindow?.enableMediaUpload && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="mimin:hidden"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            />
            <button
              type="button"
              className={cn(
                "mimin:w-7 mimin:h-7 mimin:rounded-full mimin:flex mimin:items-center mimin:justify-center mimin:cursor-pointer",
                (disabled || loading || selectedMedia.length >= MAX_FILES) &&
                  "mimin:opacity-50"
              )}
              disabled={disabled || loading || selectedMedia.length >= MAX_FILES}
              onClick={() => fileInputRef.current?.click()}
              title="Attach files"
            >
              <Paperclip
                className="mimin:w-3.5 mimin:h-3.5"
                color={footerTextColor}
              />
            </button>
          </>
        )}
      </div>

      {replyToMessage && (
        <div
          className="mimin:mb-2.5 mimin:flex mimin:items-center mimin:justify-between mimin:p-2 mimin:rounded-lg mimin:border mimin:text-xs mimin:gap-3 mimin:select-none"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.12)",
            borderColor: "rgba(255, 255, 255, 0.2)",
            color: footerTextColor,
          }}
        >
          <div className="mimin:flex mimin:flex-col mimin:gap-0.5 mimin:min-w-0 mimin:flex-1">
            <span className="mimin:font-semibold mimin:flex mimin:items-center mimin:gap-1.5 mimin:text-[10px] mimin:tracking-wide mimin:uppercase mimin:opacity-75">
              <CornerUpLeft className="mimin:h-3 mimin:w-3" />
              Replying to {replyToMessage.sender}
            </span>
            {replyToMessage.text && (
              <span className="mimin:truncate mimin:opacity-90 mimin:italic mimin:text-[11px] mimin:leading-snug">
                {replyToMessage.text}
              </span>
            )}
            {replyToMessage.file_name && (
              <span className="mimin:truncate mimin:opacity-90 mimin:text-[10px] mimin:font-medium mimin:flex mimin:items-center mimin:gap-1">
                <Paperclip className="mimin:h-3 mimin:w-3 mimin:shrink-0" />
                {replyToMessage.file_name}
              </span>
            )}
          </div>
          {onCancelReply && (
            <button
              type="button"
              className="mimin:p-1 mimin:rounded-full mimin:hover:bg-white/10 mimin:transition-colors mimin:shrink-0 mimin:cursor-pointer"
              onClick={onCancelReply}
            >
              <X className="mimin:h-4 mimin:w-4" />
            </button>
          )}
        </div>
      )}

      <div className="mimin:relative mimin:flex mimin:items-end mimin:gap-2">
        <div className="mimin:relative mimin:flex-1">
          <EmojiPicker
            isOpen={isEmojiPickerOpen}
            onClose={() => setIsEmojiPickerOpen(false)}
            onEmojiSelect={handleEmojiSelect}
          />
          <textarea
            ref={textareaRef}
            placeholder={
              config?.theme?.chatWindow?.textInput?.placeholder ||
              "Ketik pertanyaan Anda..."
            }
            className="mimin:w-full mimin:bg-white mimin:text-black mimin:rounded-lg mimin:resize-none mimin:min-h-[40px] mimin:max-h-[150px] mimin:overflow-y-auto mimin:text-sm mimin:pr-12 mimin:p-2 mimin:border mimin:focus:outline mimin:focus:outline-[#ffa100]"
            style={{
              borderColor:
                config?.theme?.chatWindow?.textInput?.borderColor || "#ffffff",
            }}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled || loading}
            rows={1}
          />
          <div className="mimin:absolute mimin:bottom-2 mimin:right-3">
            <span className="mimin:text-[10px] mimin:text-gray-400">
              {message.length}/{MAX_CHARS}
            </span>
          </div>
        </div>
        <button
          type="submit"
          className={cn(
            "mimin:w-9 mimin:h-9 mimin:flex mimin:items-center mimin:justify-center mimin:p-2 mimin:rounded-full mimin:shrink-0 mimin:cursor-pointer",
            (disabled || (!canSend && !loading)) &&
              "mimin:opacity-50 mimin:cursor-not-allowed"
          )}
          disabled={disabled || (!canSend && !loading)}
          style={{ backgroundColor: primaryColor }}
        >
          {loading ? (
            <FaCircleStop className="mimin:w-4 mimin:h-4 mimin:text-white" />
          ) : (
            <IoSend className="mimin:w-4 mimin:h-4 mimin:text-white" />
          )}
        </button>
      </div>
    </form>
  );
}

export default FormSend;
