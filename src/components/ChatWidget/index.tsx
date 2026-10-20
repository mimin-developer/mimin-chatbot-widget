import React, { useEffect, useRef, useState } from "react";
import type {
  ChatbotConfig,
  IESResponse,
  Interaction,
  Message,
} from "../../types";
import { useConfigStore } from "../../hooks/config-store";
import AuthWindow from "../Auth";
import { ChatHeader } from "./header";
import { ChatContent } from "./chat-content";
import { ChatInput } from "./input";
import { StartChatSection } from "./start-chat-section";
import { motion, AnimatePresence } from "framer-motion";
import { API, getClientInfo } from "../../services";
import { OpenAiAgentVoiceLayout } from "../CallWindow/openai-agent-voice";
import { ElevenLabsAgentVoiceLayout } from "../CallWindow/elevenlabs-agent-voice";
import { io, Socket } from "socket.io-client";
import { ENV } from "../../config/environment";
import { clearCustomerToken, getCustomerToken, isUnauthorized } from "../../utils/session";

interface ChatWidgetProps {
  config?: ChatbotConfig;
  signature: string;
  voiceAgent: 'elevenlabs' | 'openai';
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
}

interface ConversationResponse {
  session: {
    started_at: string;
    active: boolean;
  };
  messages: ConversationMessage[];
}

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

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  config,
  signature,
  voiceAgent
}) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [phoneOrIP, setPhoneOrIP] = useState<{ name: string, value: string } | null>(null);
  const [chatHistoryId, setChatHistoryId] = useState("");
  const [currentResponseMsg, setCurrentResponseMsg] = useState("");
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [chatType, setChatType] = useState("");
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isCallVisible, setIsCallVisible] = useState(false);
  const [shouldRenderChat, setShouldRenderChat] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [sessionActive, setSessionActive] = useState(true);

  const blobUrlsRef = useRef<string[]>([]);
  const { setConfig: setConfigStore, setSignature: setSignatureStore } =
    useConfigStore();

  const abortControllerRef = useRef<AbortController | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const cancelSendMessage = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const addInteraction = (interaction: Interaction) => {
    setInteractions((prev) => [interaction, ...prev]);
  };

  const updateInteractionByMessageId = (messageId: string, updates: Partial<Message>) => {
    setInteractions((prev) =>
      prev.map((item) => {
        if (item.id !== messageId) return item;
        if (item.human) {
          return { ...item, human: { ...item.human, ...updates } };
        }
        if (item.ai) {
          return { ...item, ai: { ...item.ai, ...updates } };
        }
        return item;
      })
    );
  };

  const updateAiInteractionByIndex = (index: number, message: Partial<Message>) => {
    setInteractions((prev) => {
      const next = [...prev];
      const aiIndex = next.length - 1 - index;
      if (next[aiIndex]?.ai) {
        next[aiIndex] = {
          ...next[aiIndex],
          ai: { ...next[aiIndex].ai!, ...message },
        };
      }
      return next;
    });
  };

  const handleToggleChatWindow = () => {
    if (isChatVisible) {
      setIsChatVisible(false);
    } else {
      setShouldRenderChat(true);
      setIsChatVisible(true);
    }
  };

  const handleToggleCallWindow = () => {
    setIsCallVisible(!isCallVisible);
  };

  const fetchConversations = async (fetchFrom: "send-message" | "global" = "global") => {
    if (!config?.credentials?.username || !config?.credentials?.websiteId || !phoneOrIP?.value) return;

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

      const mappedInteractions: Interaction[] = data.messages
        .slice()
        .reverse()
        .map((msg) => {
          // Backend terbalik: incoming = dari customer (human), outgoing = dari agent (ai)
          const isAgent = msg.direction === "outgoing";
          const media = msg.file ? [{ type: "image", name: msg.file_name, data: msg.file }] : undefined;

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
                },
            ai: isAgent
              ? {
                  content: msg.text,
                  additional_kwargs: {},
                  example: false,
                  media,
                }
              : undefined,
          };
        });

      if (!data.session?.active && fetchFrom === "send-message") {
        return;
      }

      setInteractions(mappedInteractions);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setFetching(false);
    }
  };

  const handleSendMessage = async (message: string, media?: { type: string; name: string; data: string }[]) => {
    if (!phoneOrIP) return;
    cancelSendMessage();
    setLoading(true);

    const isWebsite = config?.widgetType === "website";
    const hasMedia = (media?.length ?? 0) > 0;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Optimistic bubble: convert base64 ke blob URL agar tidak membebani state
    const optimisticMedia = media?.map((m) => {
      if (m.data.startsWith("data:")) {
        const blobUrl = base64ToBlobUrl(m.data);
        blobUrlsRef.current.push(blobUrl);
        return { ...m, data: blobUrl };
      }
      return m;
    });

    // Jika sesi sudah berakhir, reset interactions lalu tambahkan optimistic bubble saja
    if (!sessionActive) {
      setInteractions([]);
    }

    let optimisticId: string | null = null;

    if (message || optimisticMedia) {
      optimisticId = crypto.randomUUID();
      const optimisticInteraction: Interaction = {
        human: {
          content: message,
          additional_kwargs: {},
          example: false,
          media: optimisticMedia,
          isError: false,
        },
        date: new Date(),
        id: optimisticId,
      };

      if (!sessionActive) {
        setInteractions([optimisticInteraction]);
      } else {
        addInteraction(optimisticInteraction);
      }
    }

    try {
      let response: Response;

      if (isWebsite) {
        const token = getCustomerToken(config?.credentials?.username);
        const name = phoneOrIP.name || phoneOrIP.value;

        // Kirim base64 asli ke backend (bukan blob URL)
        const rawMedia = media?.map((m) => {
          if (m.data.startsWith("blob:")) {
            return { ...m, data: "" };
          }
          return m;
        });

        const websitePayload = {
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
            reply_to: "",
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
              ...(token ? { "Authorization-Customer": `Bearer ${token}` } : {}),
              Accept: "text/event-stream",
            },
            body: JSON.stringify(websitePayload),
            method: "POST",
            signal: abortController.signal,
          }
        );
      } else {
        let name = phoneOrIP.name;
        if (!name) name = navigator.userAgent;

        const mediaItem = media?.[0];
        const chatbotPayload = {
          name,
          phone: phoneOrIP.value,
          message_id: crypto.randomUUID(),
          message,
          media_type: mediaItem ? mediaItem.type : "text",
          media: mediaItem?.data?.startsWith("blob:") ? "" : (mediaItem?.data || ""),
          type: chatType || "",
        };

        response = await API("fetch", "chatbot")(
          `/chat/new-website/${config?.credentials?.username}`,
          {
            headers: {
              Signature: signature,
              Accept: "text/event-stream",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(chatbotPayload),
            method: "POST",
            signal: abortController.signal,
          }
        );
      }

      if (!response.ok) {
        if (
          isUnauthorized(response.status) &&
          isWebsite &&
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
          setInteractions([]);
          setCurrentResponseMsg("");
          setSessionExpired(true);
          setIsAuthenticated(false);
          return;
        }

        if (optimisticId) {
          updateInteractionByMessageId(optimisticId, { isError: true });
        }
        console.error("Failed to send message");
        return;
      }

      const reader = response
        .body!.pipeThrough(new TextDecoderStream())
        .getReader();

      if (isWebsite) {
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
              if (!chatType) setChatType(res.type);
              setChatHistoryId(res.chat_history_id);
            } else if (res.event === "token") {
              if (res.data) setCurrentResponseMsg((prev) => prev + res.data);
            }
          }
        }
      } else {
        while (true) {
          if (abortController.signal.aborted) break;
          const { value, done } = await reader!.read();
          if (done) break;

          const identifier = '{"event": ';
          const events: IESResponse[] = value
            .split(`data: ${identifier}`)
            .filter(Boolean)
            .map((res) =>
              JSON.parse(`${identifier}${res}`.replace(/\n\n$/gm, ""))
            )
            .filter((res) => (res.event === "token" ? !!res.data : true));

          events.forEach(async (res) => {
            if (res.event === "payload") {
              updateAiInteractionByIndex(0, {
                additional_kwargs: {},
                content: res.message,
                example: false,
              });
              if (!chatType) setChatType(res.type);
              setChatHistoryId(res.chat_history_id);
            } else if (res.event === "token") {
              setCurrentResponseMsg((prev) => prev + res.data);
            }
          });
        }
      }

      // Refetch conversations setelah request selesai untuk mendapatkan data real dari backend
      if (isWebsite && (!sessionActive || hasMedia)) {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            fetchConversations("send-message");
            resolve();
          }, 10_000);
        });
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        if (optimisticId) {
          updateInteractionByMessageId(optimisticId, { isError: true });
        }
        console.error("Maaf, terjadi kesalahan sistem. Silakan coba lagi!");
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    if (config?.widgetType !== "website") return;
    if (!chatHistoryId && !config?.credentials?.websiteId) return;

    const playNotificationSound = () => {
      try {
        const audio = new Audio('/sounds/notification.mp3');
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
          socket.emit("joinRoom", `${config.credentials.websiteId}-${phoneOrIP.value}`);
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

      if ((message && typeof message === "string") || (media && media.length > 0)) {
        playNotificationSound();
        // Pesan dari socket = dari agent (outgoing/ai)
        addInteraction({
          human: undefined,
          ai: {
            content: typeof message === "string" ? message : "",
            additional_kwargs: payload.additional_kwargs || {},
            example: false,
            media: media,
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
      const greeted = localStorage.getItem(`cu-greeting-${config?.credentials?.username}`);
      setIsFirstTime(!greeted);
    } else {
      setIsFirstTime(false);
    }
  }, [config]);

  useEffect(() => {
    if (!config) return;

    (async () => {
      let phoneOrIPState: { name: string, value: string } | null = null;

      if (config.theme?.chatWindow.enableLogin) {
        const token = getCustomerToken(config.credentials?.username);

        if (token) {
          try {
            const res = await API("fetch", "customer")(`/v1/customer/get-by-token/${config.credentials?.username}`, {
              method: "GET",
              headers: {
                "x-api-key": config.credentials?.apiKey || '',
                "Authorization-Customer": `Bearer ${token}`
              },
            });

            if (!res.ok) {
              if (isUnauthorized(res.status)) {
                clearCustomerToken(config.credentials?.username);
              }
              throw new Error(`Failed to get customer data (status ${res.status})`);
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
      } else {
        try {
          const { isError, errorMessage, ip } = await getClientInfo();
          if (isError) {
            console.warn("Failed to get client IP, using fallback:", errorMessage);
            phoneOrIPState = { name: '', value: "127.0.0.1" };
          } else {
            phoneOrIPState = { name: '', value: ip! };
          }
        } catch (err) {
          console.warn("Error getting client IP, using fallback:", err);
          phoneOrIPState = { name: '', value: "127.0.0.1" };
        }
      }
      setPhoneOrIP(phoneOrIPState);
    })().catch((error) => {
      console.error("ChatWidget initialization failed:", error);
    });
  }, [config]);

  useEffect(() => {
    if (config?.widgetType === "website" && phoneOrIP?.value && !isFirstTime) {
      fetchConversations();
    }
  }, [config?.widgetType, phoneOrIP?.value, isFirstTime]);

  const backgroundButtonColor = isChatVisible
    ? config?.theme?.button?.backgroundColor
    : config?.theme?.button?.backgroundColor + "80" || "#ffffff";

  const textButtonColor = isChatVisible
    ? config?.theme?.button?.textColor
    : config?.theme?.button?.backgroundColor || "#0096a2";

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
          <img
            src={config?.theme?.button?.iconSrc || "/icons/favicon.ico"}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = "/icons/favicon.ico";
            }}
            alt=" "
            className="mimin:w-4 mimin:h-auto"
          />
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
              className="mimin:absolute -mimin:top-3 mimin:right-0 mimin:text-white mimin:px-1.5 mimin:py-0.5 mimin:text-[10px] mimin:rounded-full mimin:bg-red-500 mimin:animate-pulse"
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
            animate={isChatVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
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
                backgroundColor: config?.theme?.chatWindow?.body?.backgroundColor || "#ffffff",
              }}
            >
              {(config?.theme?.chatWindow.enableLogin || false) &&
                !isAuthenticated &&
                !isFirstTime && (
                  <AuthWindow
                    onSuccessLogin={(token, phone) => {
                      setSessionExpired(false);
                      setPhoneOrIP({ name: phone.phone, value: phone.value });
                      setIsAuthenticated(!!token);
                    }}
                    sessionExpired={sessionExpired}
                    token={""}
                  />
                )}
              {(isAuthenticated || !(config?.theme?.chatWindow.enableLogin || false)) &&
                !isFirstTime && (
                  <>
                    <ChatHeader
                      onToggleCallWindow={handleToggleCallWindow}
                      onToggleChatWindow={handleToggleChatWindow}
                    />
                    <ChatContent
                      messages={interactions}
                      currentResponseMsg={currentResponseMsg}
                      loading={loading}
                      fetching={fetching}
                      isWebsite={config?.widgetType === "website"}
                      sessionActive={sessionActive}
                    />
                    <ChatInput
                      onSendMessage={(message, media) => {
                        setCurrentResponseMsg("");
                        message = message.trim().replaceAll(/\n\n+/g, "\n\n");
                        handleSendMessage(message, media);
                      }}
                      loading={loading}
                      fetching={fetching}
                      onCancelSendMessage={cancelSendMessage}
                    />
                    {voiceAgent === 'openai' ? (
                      <OpenAiAgentVoiceLayout
                        isVisible={isCallVisible}
                        onToggleCallWindow={handleToggleCallWindow}
                      />
                    ) : (
                      <ElevenLabsAgentVoiceLayout
                        isVisible={isCallVisible}
                        onToggleCallWindow={handleToggleCallWindow}
                        phoneOrIP={phoneOrIP}
                      />
                    )}
                  </>
                )}
              {isFirstTime && (config?.theme?.chatWindow?.enableGreating || false) && (
                <StartChatSection
                  onClickStartChat={() => {
                    localStorage.setItem(`cu-greeting-${config?.credentials?.username}`, 'true');
                    setIsFirstTime(false);
                  }}
                />
              )}
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
};
