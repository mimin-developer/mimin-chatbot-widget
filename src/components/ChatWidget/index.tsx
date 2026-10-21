import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ChatbotConfig,
  IESResponse,
  Interaction,
  MediaItem,
  Message,
} from "../../types";
import { useConfigStore } from "../../hooks/config-store";
import { useInteractionsStore } from "../../hooks/interaction-store";
import AuthWindow from "../Auth";
import { ChatHeader } from "./header";
import { ChatContent } from "./chat-content";
import { ChatInput } from "./input";
import { StartChatSection } from "./start-chat-section";
import { ConfigErrorCard } from "./config-error-card";
import { VoiceWidget } from "./voice-widget";
import type { ReplyMessageInfo } from "./form-send";
import { motion, AnimatePresence } from "framer-motion";
import { API, getClientInfo } from "../../services";
import { AgentVoiceLayout } from "../CallWindow/agent-voice";
import { io, Socket } from "socket.io-client";
import { MessageCircle } from "lucide-react";
import { ENV } from "../../config/environment";
import {
  clearCustomerToken,
  getCustomerToken,
  isUnauthorized,
} from "../../utils/session";

interface ChatWidgetProps {
  config?: ChatbotConfig;
  signature: string;
  voiceName?: string;
  configErrors?: string[];
}

interface ConversationMessage {
  id: string;
  direction: "incoming" | "outgoing";
  text: string;
  file: string;
  file_name: string;
  status: string;
  from_chatbot: boolean;
  created_at: string;
  context_id?: string;
  context?: Message["context"];
}

interface ConversationResponse {
  session: {
    started_at: string;
    active: boolean;
  };
  messages: ConversationMessage[];
}

interface PendingMessage {
  tempId: string;
  text: string;
  media?: MediaItem[];
  abortController: AbortController;
}

const CALL_TOGGLE_COOLDOWN_MS = 5_000;

function base64ToBlobUrl(base64: string): string {
  const [header, data] = base64.split(",");
  const mimeMatch = header?.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] || "application/octet-stream";
  const byteCharacters = atob(data);
  const byteArrays: BlobPart[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
    const slice = byteCharacters.slice(offset, offset + 1024);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers) as BlobPart);
  }

  const blob = new Blob(byteArrays, { type: mime });
  return URL.createObjectURL(blob);
}

const getFileExtension = (filename: string): string =>
  filename.split(".").pop()?.toLowerCase() || "";

const hasKnownExtension = (
  name: string,
  data: string,
  extensions: string[]
): boolean => {
  if (extensions.includes(getFileExtension(name))) return true;
  if (data) {
    const cleanData = data.split("?")[0];
    if (extensions.includes(getFileExtension(cleanData))) return true;
  }
  return false;
};

const classifyFileType = (
  name: string,
  data: string
): "image" | "video" | "audio" | "document" => {
  if (hasKnownExtension(name, data, ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"]))
    return "image";
  if (
    hasKnownExtension(name, data, [
      "mp4",
      "webm",
      "mov",
      "avi",
      "mkv",
      "m4v",
      "3gp",
      "ogv",
    ])
  )
    return "video";
  if (
    hasKnownExtension(name, data, [
      "mp3",
      "wav",
      "ogg",
      "aac",
      "m4a",
      "webm",
      "flac",
    ])
  )
    return "audio";
  return "document";
};

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  config,
  signature,
  voiceName,
  configErrors,
}) => {
  const widgetType = config?.widgetType ?? "chatbot";

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [phoneOrIP, setPhoneOrIP] = useState<{ name: string; value: string } | null>(null);
  const [chatHistoryId, setChatHistoryId] = useState("");
  const [currentResponseMsg, setCurrentResponseMsg] = useState("");
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isCallVisible, setIsCallVisible] = useState(false);
  const [isCallToggleLocked, setIsCallToggleLocked] = useState(false);
  const [shouldRenderChat, setShouldRenderChat] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [sessionActive, setSessionActive] = useState(true);
  const [replyToMessage, setReplyToMessage] = useState<ReplyMessageInfo | null>(null);

  const interactions = useInteractionsStore((s) => s.interactions);
  const chatType = useInteractionsStore((s) => s.chatType) ?? "";

  const blobUrlsRef = useRef<string[]>([]);
  // Data asli (data URL) tiap blob URL lampiran optimistic, supaya retry mengirim file utuh.
  const blobSourcesRef = useRef<Map<string, string>>(new Map());
  const pendingMessagesRef = useRef<Map<string, PendingMessage>>(new Map());
  const tempIdCounterRef = useRef(0);
  const handleSendMessageRef = useRef<
    | ((message: string, media?: MediaItem[], replyToId?: string) => Promise<void>)
    | null
  >(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const { setConfig: setConfigStore, setSignature: setSignatureStore } =
    useConfigStore();

  const updateInteractions = useCallback(
    (
      updater:
        | Interaction[]
        | ((prev: Interaction[]) => Interaction[])
    ) => {
      const store = useInteractionsStore.getState();
      const next =
        typeof updater === "function" ? updater(store.interactions) : updater;
      store.setInteractions(next);
    },
    []
  );

  const updateChatType = useCallback((type: string) => {
    useInteractionsStore.getState().setChatType(type);
  }, []);

  const cancelSendMessage = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const cancelPendingMessage = useCallback(
    (tempId: string) => {
      const pending = pendingMessagesRef.current.get(tempId);
      if (pending) {
        pending.abortController.abort();
        pendingMessagesRef.current.delete(tempId);
      }
      updateInteractions((prev) =>
        prev.map((item) => {
          if (item.id === tempId && item.human) {
            return {
              ...item,
              human: {
                ...item.human,
                status: "failed" as const,
                isError: true,
                isUploading: false,
              },
            };
          }
          return item;
        })
      );
    },
    [updateInteractions]
  );

  const addInteraction = useCallback((interaction: Interaction) => {
    useInteractionsStore.getState().addInteraction(interaction);
  }, []);

  const updateInteractionByMessageId = useCallback(
    (messageId: string, updates: Partial<Message>) => {
      updateInteractions((prev) =>
        prev.map((item) => {
          if (item.id !== messageId && !item.id.startsWith(messageId + "-"))
            return item;
          if (item.human) {
            return { ...item, human: { ...item.human, ...updates } };
          }
          if (item.ai) {
            return { ...item, ai: { ...item.ai, ...updates } };
          }
          return item;
        })
      );
    },
    [updateInteractions]
  );

  const updateAiInteractionByIndex = useCallback(
    (index: number, message: Partial<Message>) => {
      updateInteractions((prev) => {
        const next = [...prev];
        if (next[index]) {
          next[index] = {
            ...next[index],
            ai: {
              content: "",
              additional_kwargs: {},
              example: false,
              ...next[index].ai,
              ...message,
            },
          };
        }
        return next;
      });
    },
    [updateInteractions]
  );

  const removeInteractionById = useCallback(
    (messageId: string) => {
      updateInteractions((prev) =>
        prev.filter(
          (item) =>
            item.id !== messageId && !item.id.startsWith(messageId + "-")
        )
      );
    },
    [updateInteractions]
  );

  const handleToggleChatWindow = () => {
    if (isChatVisible) {
      setIsChatVisible(false);
    } else {
      setShouldRenderChat(true);
      setIsChatVisible(true);
    }
  };

  const handleToggleCallWindow = useCallback(() => {
    if (isCallToggleLocked) return;
    setIsCallVisible((prev) => {
      if (prev) {
        // Call ended: lock the toggle briefly so a double-tap cannot restart it instantly
        setIsCallToggleLocked(true);
        if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = setTimeout(() => {
          setIsCallToggleLocked(false);
        }, CALL_TOGGLE_COOLDOWN_MS);
      }
      return !prev;
    });
  }, [isCallToggleLocked]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  const fetchConversations = useCallback(async () => {
    if (widgetType !== "chatbot") return;
    if (!config?.credentials?.username || !config?.credentials?.websiteId || !phoneOrIP?.value)
      return;

    setFetching(true);
    try {
      const res = await API("fetch", "customer")(
        `/v1/website/conversation/${config.credentials.username}?website_id=${config.credentials.websiteId}&phone=${phoneOrIP.value}`,
        {
          method: "GET",
          headers: {
            "x-api-key": config.credentials.apiKey || "",
          },
        }
      );

      if (!res.ok) return;

      const data: ConversationResponse = await res.json();

      setSessionActive(data.session?.active ?? true);

      // Revoke blob URLs dari optimistic bubble sebelum replace dengan data real
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
      blobSourcesRef.current.clear();

      const mappedInteractions: Interaction[] = data.messages
        .slice()
        .reverse()
        .map((msg) => {
          // Backend terbalik: incoming = dari customer (human), outgoing = dari agent (ai)
          const isAgent = msg.direction === "outgoing";
          const media = msg.file
            ? [
                {
                  type: classifyFileType(msg.file_name, msg.file),
                  name: msg.file_name,
                  data: msg.file,
                },
              ]
            : undefined;

          return {
            id: msg.id,
            date: msg.created_at,
            human: isAgent
              ? undefined
              : {
                  content: msg.text,
                  additional_kwargs: {},
                  example: false,
                  media,
                  status: "sent" as const,
                  context_id: msg.context_id,
                  context: msg.context,
                },
            ai: isAgent
              ? {
                  content: msg.text,
                  additional_kwargs: {},
                  example: false,
                  media,
                  status: "sent" as const,
                  context_id: msg.context_id,
                  context: msg.context,
                }
              : undefined,
          };
        });

      // BE hanya mengirim pesan sesi berjalan. Pesan sesi sebelumnya yang sudah
      // tampil dipertahankan; bubble optimistic dan bubble sesi berjalan dibuang
      // supaya tidak terduplikasi dengan data server.
      updateInteractions((prev) => {
        const serverIds = new Set(mappedInteractions.map((item) => item.id));
        const oldestServerTime = mappedInteractions.length
          ? new Date(
              mappedInteractions[mappedInteractions.length - 1].date
            ).getTime()
          : Number.POSITIVE_INFINITY;

        const previousSessions = prev.filter(
          (item) =>
            !serverIds.has(item.id) &&
            !item.id.startsWith("optimistic-") &&
            new Date(item.date).getTime() < oldestServerTime
        );
        return [...mappedInteractions, ...previousSessions];
      });
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setFetching(false);
    }
  }, [
    widgetType,
    config?.credentials?.username,
    config?.credentials?.websiteId,
    config?.credentials?.apiKey,
    phoneOrIP?.value,
    updateInteractions,
  ]);

  const handleRetryMessage = useCallback(
    async (tempId: string) => {
      // Baca langsung dari state render terakhir; updater setInteractions tidak
      // dijamin sinkron sehingga data bubble gagal bisa masih kosong saat dicek
      const item = interactions.find((i) => i.id === tempId);
      if (!item?.human) return;

      const failedText = item.human.content;
      // Lampiran optimistic tampil sebagai blob URL; kirim ulang dengan data aslinya
      const failedMedia = item.human.media?.map((m) => {
        const source = blobSourcesRef.current.get(m.data);
        return source ? { ...m, data: source } : m;
      });
      const failedReplyToId = item.human.context_id;

      if (!failedText && !failedMedia?.length) return;

      removeInteractionById(tempId);

      if (handleSendMessageRef.current) {
        await handleSendMessageRef.current(failedText, failedMedia, failedReplyToId);
      }
    },
    [interactions, removeInteractionById]
  );

  const handleSendMessage = useCallback(
    async (message: string, media?: MediaItem[], replyToId?: string) => {
      handleSendMessageRef.current = handleSendMessage;
      if (!phoneOrIP) return;
      cancelSendMessage();
      setLoading(true);

      tempIdCounterRef.current += 1;
      const baseTempId = `optimistic-${Date.now()}-${tempIdCounterRef.current}`;

      const optimisticMedia = media?.map((m) => {
        if (m.data.startsWith("data:")) {
          const blobUrl = base64ToBlobUrl(m.data);
          blobUrlsRef.current.push(blobUrl);
          blobSourcesRef.current.set(blobUrl, m.data);
          return { ...m, data: blobUrl };
        }
        return m;
      });

      let optimisticId: string | null = null;
      const optimisticInteractions: Interaction[] = [];

      if (message || (optimisticMedia && optimisticMedia.length > 0)) {
        optimisticId = baseTempId;

        const optReplyContext =
          replyToId && replyToMessage
            ? {
                id: replyToMessage.id,
                direction: (replyToMessage.sender === "You"
                  ? "outgoing"
                  : "incoming") as "incoming" | "outgoing",
                text: replyToMessage.text,
                file: "",
                file_name: replyToMessage.file_name || "",
              }
            : undefined;

        if (optimisticMedia && optimisticMedia.length > 1) {
          optimisticMedia.forEach((m, index) => {
            const id = `${baseTempId}-${index}`;
            optimisticInteractions.push({
              human: {
                content: index === 0 ? message : "",
                additional_kwargs: {},
                example: false,
                media: [m],
                isError: false,
                status: "pending",
                _tempId: id,
                isUploading: true,
                context_id: replyToId,
                context: optReplyContext,
              },
              date: new Date(),
              id,
            });
          });
        } else {
          optimisticInteractions.push({
            human: {
              content: message,
              additional_kwargs: {},
              example: false,
              media: optimisticMedia || [],
              isError: false,
              status: "pending",
              _tempId: baseTempId,
              isUploading: true,
              context_id: replyToId,
              context: optReplyContext,
            },
            date: new Date(),
            id: baseTempId,
          });
        }

        if (!sessionActive) {
          updateInteractions(optimisticInteractions);
        } else {
          updateInteractions((prev) => [
            ...optimisticInteractions.slice().reverse(),
            ...prev,
          ]);
        }
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const pendingMsg: PendingMessage = {
        tempId: baseTempId,
        text: message,
        media,
        abortController,
      };
      const tempIds = [baseTempId];
      if (optimisticMedia && optimisticMedia.length > 1) {
        optimisticMedia.forEach((_, i) => {
          if (i > 0) tempIds.push(`${baseTempId}-${i}`);
        });
      }
      tempIds.forEach((id) => {
        pendingMessagesRef.current.set(id, pendingMsg);
      });

      const markFailed = () => {
        tempIds.forEach((id) => {
          pendingMessagesRef.current.delete(id);
          updateInteractionByMessageId(id, {
            isError: true,
            status: "failed",
            isUploading: false,
          });
        });
      };

      try {
        const rawMedia = media?.map((m) => {
          if (m.data.startsWith("blob:")) {
            return { ...m, data: "" };
          }
          return m;
        });

        let response: Response;

        const token = getCustomerToken(config?.credentials?.username);
        const name = phoneOrIP.name || phoneOrIP.value;

        const chatbotPayload = {
          sender: {
            name,
            phone: phoneOrIP.value,
            type: chatType || "",
          },
          recipient: {
            id: config?.credentials?.websiteId || "",
          },
          message: {
            id: crypto.randomUUID(),
            reply_to: replyToId || "",
            text: message,
            media: rawMedia || [],
          },
        };

        response = await API("fetch", "customer")(
          `/v1/website/webhook/${config?.credentials?.username}`,
          {
            headers: {
              "Content-Type": "application/json",
              "x-api-key": config?.credentials?.apiKey || "",
              ...(token
                ? { "Authorization-Customer": `Bearer ${token}` }
                : {}),
              Accept: "text/event-stream",
            },
            body: JSON.stringify(chatbotPayload),
            method: "POST",
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          markFailed();

          if (
            isUnauthorized(response.status) &&
            config?.theme?.chatWindow?.enableLogin
          ) {
            const username = config?.credentials?.username;
            console.error(
              `Session expired: got 401 while sending message for user "${username}"`
            );
            if (username) {
              clearCustomerToken(username);
            }
            blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            blobUrlsRef.current = [];
            blobSourcesRef.current.clear();
            updateInteractions([]);
            setCurrentResponseMsg("");
            setSessionExpired(true);
            setIsAuthenticated(false);
            return;
          }

          console.error("Failed to send message");
          return;
        }

        const reader = response
          .body!.pipeThrough(new TextDecoderStream())
          .getReader();

        let buffer = "";
        while (true) {
          if (abortController.signal.aborted) break;
          const { value, done } = await reader.read();
          if (done) break;

          buffer += value;
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const dataLines = part
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.replace(/^data:\s?/, ""));

            if (!dataLines.length) continue;

            const data = dataLines.join("\n");
            const res: IESResponse = JSON.parse(data);

            if (res.event === "payload") {
              updateAiInteractionByIndex(0, {
                additional_kwargs: {},
                content: res.message,
                example: false,
              });
              if (!chatType) updateChatType(res.type);
              setChatHistoryId(res.chat_history_id);
            } else if (res.event === "token") {
              if (res.data) setCurrentResponseMsg((prev) => prev + res.data);
            }
          }
        }

        // Mark optimistic bubbles as sent (no longer uploading)
        tempIds.forEach((id) => {
          pendingMessagesRef.current.delete(id);
          updateInteractionByMessageId(id, {
            status: "sent",
            isUploading: false,
          });
        });

        setTimeout(() => {
          fetchConversations();
        }, 5_000);
      } catch (err: any) {
        markFailed();
        if (err?.name !== "AbortError") {
          console.error(
            "Maaf, terjadi kesalahan sistem. Silakan coba lagi!",
            err
          );
        }
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      phoneOrIP,
      chatType,
      config?.credentials?.apiKey,
      config?.credentials?.username,
      config?.credentials?.websiteId,
      config?.theme?.chatWindow?.enableLogin,
      sessionActive,
      replyToMessage,
      cancelSendMessage,
      updateInteractions,
      updateInteractionByMessageId,
      updateAiInteractionByIndex,
      updateChatType,
      fetchConversations,
    ]
  );

  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  const resolveClientIdentity = useCallback(async () => {
    try {
      const { isError, errorMessage, ip } = await getClientInfo();
      if (isError) {
        console.warn("Failed to get client IP, using fallback:", errorMessage);
        return { name: "", value: "127.0.0.1" };
      }
      return { name: "", value: ip! };
    } catch (err) {
      console.warn("Error getting client IP, using fallback:", err);
      return { name: "", value: "127.0.0.1" };
    }
  }, []);

  const handleLogout = useCallback(async () => {
    const username = config?.credentials?.username;
    if (!username) return;
    clearCustomerToken(username);
    setIsAuthenticated(false);
    updateInteractions([]);
    setCurrentResponseMsg("");
    setSessionExpired(false);
    const identity = await resolveClientIdentity();
    setPhoneOrIP(identity);
  }, [config?.credentials?.username, resolveClientIdentity, updateInteractions]);

  useEffect(() => {
    if (widgetType !== "chatbot") return;
    if (!chatHistoryId && !config?.credentials?.websiteId) return;

    const playNotificationSound = () => {
      try {
        const audio = new Audio("/sounds/notification.mp3");
        audio.volume = 1;
        audio.play().catch(() => {});
      } catch {
      }
    };

    const socket = io(ENV.NEXT_PUBLIC_API_SOCKET, {
      path: ENV.NEXT_PUBLIC_API_SOCKET_PATHNAME,
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      if (socket.connected) {
        if (chatHistoryId) {
          socket.emit("joinRoom", chatHistoryId);
        }
        if (config?.credentials?.websiteId && phoneOrIP?.value) {
          socket.emit(
            "joinRoom",
            `${config.credentials.websiteId}-${phoneOrIP.value}`
          );
        }
      }
    });

    const handleEndSession = (data: { message: string }) => {
      const msg = data.message || "";
      addInteraction({
        human: undefined,
        ai: { content: msg, additional_kwargs: {}, example: false },
        date: new Date(),
        id: crypto.randomUUID(),
      });
      setCurrentResponseMsg(msg);
    };

    const handleReminderFired = (data: { message: string }) => {
      const msg = data.message || "";
      addInteraction({
        human: undefined,
        ai: { content: msg, additional_kwargs: {}, example: false },
        date: new Date(),
        id: crypto.randomUUID(),
      });
      setCurrentResponseMsg(msg);
    };

    const handleWebsiteMessage = (data: any) => {
      const payload = data.payload || data;
      const message =
        payload.text ||
        (typeof payload.message === "object"
          ? payload.message?.text
          : payload.message) ||
        (typeof payload.message === "string" ? payload.message : "") ||
        "";

      const media = payload.media || payload.message?.media || [];

      if (
        (message && typeof message === "string") ||
        (media && media.length > 0)
      ) {
        playNotificationSound();
        // Pesan dari socket = dari agent (outgoing/ai)
        addInteraction({
          human: undefined,
          ai: {
            content: typeof message === "string" ? message : "",
            additional_kwargs: payload.additional_kwargs || {},
            example: false,
            media: media,
            context_id: payload.message?.reply_to,
            context: payload.context || payload.message?.context,
          },
          date: new Date(),
          id: data.message_id || payload.message?.id || crypto.randomUUID(),
        });
        setCurrentResponseMsg(typeof message === "string" ? message : "");
      }

      setTimeout(() => {
        fetchConversations();
      }, 7_000);
    };

    socket.on("endSession", handleEndSession);
    socket.on("reminderFired", handleReminderFired);
    socket.on("websiteMessage", handleWebsiteMessage);

    return () => {
      socket.off("endSession", handleEndSession);
      socket.off("reminderFired", handleReminderFired);
      socket.off("websiteMessage", handleWebsiteMessage);
      socket.disconnect();
    };
  }, [chatHistoryId, config?.credentials?.websiteId, phoneOrIP]);

  useEffect(() => {
    setConfigStore(config || null);
    setSignatureStore(signature || "");

    const revokeAllBlobs = () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
      blobSourcesRef.current.clear();
    };

    window.addEventListener("beforeunload", revokeAllBlobs);

    return () => {
      cancelSendMessage();
      socketRef.current?.disconnect();
      revokeAllBlobs();
      window.removeEventListener("beforeunload", revokeAllBlobs);
    };
  }, []);

  useEffect(() => {
    if (config?.theme?.chatWindow?.enableGreating ?? false) {
      const greeted = localStorage.getItem(
        `cu-greeting-${config?.credentials?.username}`
      );
      setIsFirstTime(!greeted);
    } else {
      setIsFirstTime(false);
    }
  }, [config]);

  useEffect(() => {
    if (!config) return;
    if (configErrors && configErrors.length > 0) return;

    (async () => {
      let phoneOrIPState: { name: string; value: string } | null = null;

      if (config.theme?.chatWindow.enableLogin) {
        const token = getCustomerToken(config.credentials?.username);

        if (token) {
          try {
            const res = await API("fetch", "customer")(
              `/v1/customer/get-by-token/${config.credentials?.username}`,
              {
                method: "GET",
                headers: {
                  "x-api-key": config.credentials?.apiKey || "",
                  "Authorization-Customer": `Bearer ${token}`,
                },
              }
            );

            if (!res.ok) {
              if (isUnauthorized(res.status)) {
                clearCustomerToken(config.credentials?.username);
              }
              throw new Error(
                `Failed to get customer data (status ${res.status})`
              );
            }

            const data = await res.json();
            phoneOrIPState = { name: data.data.name, value: data.data.phone };
            setIsAuthenticated(true);
          } catch (error) {
            console.error(
              `Failed to get customer data for user "${config.credentials?.username}":`,
              error
            );
            throw error;
          }
        }
      }

      if (!phoneOrIPState) {
        phoneOrIPState = await resolveClientIdentity();
      }

      setPhoneOrIP(phoneOrIPState);
    })().catch((error) => {
      console.error("ChatWidget initialization failed:", error);
    });
  }, [config, configErrors, resolveClientIdentity]);

  useEffect(() => {
    if (widgetType !== "chatbot") return;
    useInteractionsStore
      .getState()
      .loadSession(config?.credentials?.username, config?.credentials?.websiteId);
  }, [widgetType, config?.credentials?.username, config?.credentials?.websiteId]);

  useEffect(() => {
    if (widgetType === "chatbot" && phoneOrIP?.value && !isFirstTime) {
      fetchConversations();
    }
  }, [widgetType, phoneOrIP?.value, isFirstTime, fetchConversations]);

  const backgroundButtonColor = isChatVisible
    ? config?.theme?.button?.backgroundColor
    : config?.theme?.button?.backgroundColor + "80" || "#ffffff";

  const textButtonColor = isChatVisible
    ? config?.theme?.button?.textColor
    : config?.theme?.button?.backgroundColor || "#0096a2";

  const enableVoice =
    config?.data?.enable_voice ??
    config?.theme?.chatWindow?.isActiveCall ??
    false;

  return (
    <AnimatePresence>
      <div className="mimin:fixed mimin:bottom-6 mimin:right-6 mimin:z-[9999]">
        <button
          id="mimin-widget-btn-trigger"
          className="mimin:relative mimin:flex mimin:items-center mimin:gap-2.5 mimin:px-4 mimin:py-2 mimin:rounded-full mimin:border mimin:border-[#0096a2] mimin:shadow-md mimin:transition-all mimin:duration-300 mimin:ease-in-out mimin:cursor-pointer"
          style={{
            backgroundColor: backgroundButtonColor,
            color: textButtonColor,
          }}
          onClick={handleToggleChatWindow}
        >
          {config?.theme?.button?.iconSrc ? (
            <img
              src={config.theme.button.iconSrc}
              alt=" "
              className="mimin:w-4 mimin:h-auto"
            />
          ) : (
            <MessageCircle className="mimin:w-4 mimin:h-4" />
          )}
          <span className="mimin:text-sm mimin:font-bold">
            {config?.theme?.button?.tooltip || "Ask Mimin"}
          </span>

          {isCallVisible && !isChatVisible && (
            <motion.div
              key="call-badge"
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="mimin:absolute mimin:-top-3 mimin:right-0 mimin:text-white mimin:px-1.5 mimin:py-0.5 mimin:text-[10px] mimin:rounded-full mimin:bg-red-500 mimin:animate-pulse"
            >
              In Call
            </motion.div>
          )}
        </button>

        {shouldRenderChat && (
          <motion.div
            id="mimin-widget-main"
            className="mimin:absolute mimin:bottom-full mimin:mb-4 mimin:right-0"
            initial={{ opacity: 0, y: 20 }}
            animate={
              isChatVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }
            }
            transition={{ duration: 0.3, ease: "easeOut" }}
            onAnimationComplete={() => {
              if (!isChatVisible) {
                setShouldRenderChat(false);
              }
            }}
          >
            <div
              className="mimin:relative mimin:flex mimin:flex-col mimin:border mimin:border-gray-200 mimin:rounded-xl mimin:shadow-lg mimin:overflow-hidden"
              style={{
                width: config?.theme?.chatWindow?.width || "330px",
                height: config?.theme?.chatWindow?.height || "600px",
                backgroundColor:
                  config?.theme?.chatWindow?.body?.backgroundColor || "#ffffff",
              }}
            >
              {configErrors && configErrors.length > 0 ? (
                <ConfigErrorCard errors={configErrors} />
              ) : widgetType === "voice-ai" ? (
                <VoiceWidget
                  config={config}
                  voiceName={voiceName}
                  phoneOrIP={phoneOrIP}
                  isAuthenticated={isAuthenticated}
                  sessionExpired={sessionExpired}
                  onSuccessLogin={(token, phone) => {
                    setSessionExpired(false);
                    setPhoneOrIP({ name: phone.phone, value: phone.value });
                    setIsAuthenticated(!!token);
                  }}
                  onLogout={handleLogout}
                />
              ) : (
                <React.Fragment>
                  {(config?.theme?.chatWindow.enableLogin || false) &&
                    !isAuthenticated &&
                    !isFirstTime && (
                      <AuthWindow
                        onSuccessLogin={(token, phone) => {
                          setSessionExpired(false);
                          setPhoneOrIP({
                            name: phone.phone,
                            value: phone.value,
                          });
                          setIsAuthenticated(!!token);
                        }}
                        sessionExpired={sessionExpired}
                        token={""}
                      />
                    )}
                  {(isAuthenticated ||
                    !(config?.theme?.chatWindow.enableLogin || false)) &&
                    !isFirstTime && (
                      <>
                        <ChatHeader
                          onToggleCallWindow={
                            enableVoice ? handleToggleCallWindow : undefined
                          }
                          onToggleChatWindow={handleToggleChatWindow}
                          onLogout={
                            (config?.theme?.chatWindow.enableLogin || false) &&
                            isAuthenticated
                              ? handleLogout
                              : undefined
                          }
                        />
                        <ChatContent
                          messages={interactions}
                          currentResponseMsg={currentResponseMsg}
                          loading={loading}
                          fetching={fetching}
                          sessionActive={sessionActive}
                          onRetryMessage={handleRetryMessage}
                          onCancelMessage={cancelPendingMessage}
                          onReplyMessage={setReplyToMessage}
                        />
                        <ChatInput
                          onSendMessage={(message, media, replyToId) => {
                            setCurrentResponseMsg("");
                            const cleaned = message
                              .trim()
                              .replaceAll(/\n\n+/g, "\n\n");
                            handleSendMessage(cleaned, media, replyToId);
                            setReplyToMessage(null);
                          }}
                          loading={loading}
                          fetching={fetching}
                          onCancelSendMessage={cancelSendMessage}
                          replyToMessage={replyToMessage}
                          onCancelReply={() => setReplyToMessage(null)}
                        />
                        {phoneOrIP && (
                          <AgentVoiceLayout
                            isVisible={isCallVisible}
                            onToggleCallWindow={handleToggleCallWindow}
                            phone={phoneOrIP.value}
                            chatbotAgentId={config?.credentials?.voiceAgentId}
                            voiceName={voiceName}
                          />
                        )}
                      </>
                    )}
                  {isFirstTime &&
                    (config?.theme?.chatWindow?.enableGreating || false) && (
                      <StartChatSection
                        onClickStartChat={() => {
                          localStorage.setItem(
                            `cu-greeting-${config?.credentials?.username}`,
                            "true"
                          );
                          setIsFirstTime(false);
                        }}
                      />
                    )}
                </React.Fragment>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
};
