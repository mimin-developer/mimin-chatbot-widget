import React, { useState, useEffect, useRef } from "react";
import { MdPhone, MdMic, MdMicOff } from "react-icons/md";
import { motion } from "framer-motion";
import {
  GoogleGenAI,
  Modality,
  ThinkingLevel,
  type LiveConnectConfig,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import {
  audioCircleVariants,
  blinkingTextVariants,
  childVariants,
  containerVariants,
  dividerVariants,
  hangUpButtonVariants,
} from "./animate";
import { AudioVisualizer } from "./audio-visualizer";
import { useConfigStore } from "../../hooks/config-store";
import { API, createRealtimeSession, getClientInfo } from "../../services";
import type { RealtimeSession } from "../../types";
import { blobToBase64, executeToolCall, formatAudioCurrentTime } from "../../utils";

interface GeminiAgentVoiceProps {
  isVisible: boolean;
  onToggleCallWindow: () => void;
  phone: string;
  chatbotAgentId?: string;
  voiceName?: string;
  session: RealtimeSession;
}

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const DEFAULT_LIVE_MODEL = "gemini-3.8-live-extended-thinking";
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_STABLE_MS = 5000;

const GEMINI_VOICES = [
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede",
  "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
  "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi",
  "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
];

const resolveGeminiVoice = (voiceName?: string): string | undefined =>
  GEMINI_VOICES.find((voice) => voice.toLowerCase() === voiceName?.toLowerCase());

function floatToBase64PCM16(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64PCM16ToFloat(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const float32 = new Float32Array(bytes.length >> 1);
  for (let i = 0; i < float32.length; i++) {
    const int16 = view.getInt16(i * 2, true);
    float32[i] = int16 / (int16 < 0 ? 0x8000 : 0x7fff);
  }
  return float32;
}

export const GeminiAgentVoiceLayout: React.FC<GeminiAgentVoiceProps> = ({
  isVisible,
  onToggleCallWindow,
  phone,
  chatbotAgentId,
  voiceName,
  session,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  const updateSessionId = (id: string | null) => {
    setSessionId(id);
    sessionIdRef.current = id;
  };

  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [aiMediaStream, setAiMediaStream] = useState<MediaStream | null>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "listening" | "speaking" | "processing">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callFailed, setCallFailed] = useState(false);

  const { config } = useConfigStore();
  const apiKey = config?.credentials?.apiKey || "";

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingContextRef = useRef<AudioContext | null>(null);
  const isRecordingStartedRef = useRef(false);
  const userMediaRef = useRef<MediaStream | null>(null);

  const geminiSessionRef = useRef<Session | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const nextPlayTimeRef = useRef(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const toolsRef = useRef<any[]>([]);
  const sessionResumptionHandleRef = useRef<string | undefined>(undefined);
  const initialSessionUsedRef = useRef(false);
  const isMutedRef = useRef(false);
  const isHangingUpRef = useRef(false);
  const isProcessingRef = useRef(false);

  const time = formatAudioCurrentTime(elapsedSeconds);
  const isProcessing = aiStatus === "processing";

  useEffect(() => {
    if (!isCallActive) return;
    const interval = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isCallActive]);

  const ensureMicStream = async (): Promise<MediaStream> => {
    if (userMediaRef.current) return userMediaRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    userMediaRef.current = stream;
    return stream;
  };

  const startRecording = async (micStream: MediaStream) => {
    try {
      const mixContext = new AudioContext();
      recordingContextRef.current = mixContext;
      const destination = mixContext.createMediaStreamDestination();

      mixContext.createMediaStreamSource(micStream).connect(destination);

      if (outputDestinationRef.current) {
        mixContext.createMediaStreamSource(outputDestinationRef.current.stream).connect(destination);
      }

      recordingStreamRef.current = destination.stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";

      mediaRecorderRef.current = new MediaRecorder(destination.stream, { mimeType });
      recordedChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const chunks = [...recordedChunksRef.current];
        const blob = new Blob(chunks, { type: mimeType });
        releaseRecordingResources();

        if (!cancelledRef.current) {
          setRecordingUrl(URL.createObjectURL(blob));
        }

        const currentSessionId = sessionIdRef.current;
        if (!currentSessionId) return;
        try {
          const base64 = await blobToBase64(blob);
          await API("axios", "customer")({
            url: `/v1/call-session/update/${config?.credentials?.username}/${currentSessionId}`,
            method: "POST",
            headers: { "x-api-key": apiKey },
            data: { audio_base64: base64 },
          });
        } catch (err) {}
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);

      const { isError } = await getClientInfo();
      if (!isError) {
        const response = await API("axios", "customer")({
          url: `/v1/call-session/create-draft/${config?.credentials?.username}`,
          method: "POST",
          headers: { "x-api-key": apiKey },
          data: {
            phone_number: phone,
            ...(chatbotAgentId && { chatbot_agent: chatbotAgentId }),
          },
        });
        if (response.data?.session_id?._id) updateSessionId(response.data.session_id._id);
      }
    } catch (error) {}
  };

  const releaseRecordingResources = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    if (recordingContextRef.current && recordingContextRef.current.state !== "closed") {
      void recordingContextRef.current.close().catch(() => {});
    }
    recordingContextRef.current = null;
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    recorder.stop();
    setIsRecording(false);
  };

  const toggleMute = () => {
    const newMuteState = !isMuted;
    userMediaRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !newMuteState;
    });
    isMutedRef.current = newMuteState;

    if (newMuteState) {
      try {
        geminiSessionRef.current?.sendRealtimeInput({ audioStreamEnd: true });
      } catch (error) {}
    }

    setIsMuted(newMuteState);
  };

  const playAudioChunk = (base64Audio: string) => {
    const outputCtx = outputAudioContextRef.current;
    const destination = outputDestinationRef.current;
    if (!outputCtx || !destination || outputCtx.state === "closed") return;

    const float32 = base64PCM16ToFloat(base64Audio);
    if (float32.length === 0) return;

    const audioBuffer = outputCtx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    audioBuffer.copyToChannel(float32, 0);

    const source = outputCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(destination);
    source.connect(outputCtx.destination);

    const startAt = Math.max(outputCtx.currentTime, nextPlayTimeRef.current);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + audioBuffer.duration;

    scheduledSourcesRef.current.add(source);
    source.onended = () => scheduledSourcesRef.current.delete(source);
  };

  const stopPlayback = () => {
    scheduledSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (error) {}
    });
    scheduledSourcesRef.current.clear();
    nextPlayTimeRef.current = outputAudioContextRef.current?.currentTime ?? 0;
  };

  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;
    cancelledRef.current = false;
    let reconnectAttempts = 0;
    let stabilizeTimer: ReturnType<typeof setTimeout> | null = null;

    setIsConnecting(true);
    setCallFailed(false);
    isHangingUpRef.current = false;
    isRecordingStartedRef.current = false;
    initialSessionUsedRef.current = false;
    isProcessingRef.current = false;
    sessionResumptionHandleRef.current = undefined;

    const handleMessage = async (message: LiveServerMessage) => {
      const content = message.serverContent;

      if (content?.interrupted) {
        stopPlayback();
        setAiStatus("listening");
      }

      if (content?.modelTurn?.parts?.length) {
        let hasAudio = false;
        for (const part of content.modelTurn.parts) {
          if (part.inlineData?.data) {
            playAudioChunk(part.inlineData.data);
            hasAudio = true;
          }
        }
        if (hasAudio) setAiStatus("speaking");
      }

      if (content?.turnComplete) setAiStatus("listening");

      if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle) {
        sessionResumptionHandleRef.current = message.sessionResumptionUpdate.newHandle;
      }

      if (message.toolCall?.functionCalls?.length) {
        const activeSession = geminiSessionRef.current;
        if (!activeSession) return;

        isProcessingRef.current = true;
        setAiStatus("processing");
        userMediaRef.current?.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });

        try {
          for (const fc of message.toolCall.functionCalls) {
            const toolName = fc.name ?? "";
            const toolResult = await executeToolCall(toolsRef.current, toolName, fc.args || {});
            activeSession.sendToolResponse({
              functionResponses: [{ id: fc.id, name: toolName, response: { output: toolResult } }],
            });
          }
        } finally {
          isProcessingRef.current = false;
          userMediaRef.current?.getAudioTracks().forEach((track) => {
            track.enabled = !isMutedRef.current;
          });
          setAiStatus("listening");
        }
      }
    };

    const logGeminiSessionEvent = (
      eventName: string,
      event: unknown,
      _extra: Record<string, unknown>
    ) => {
      console.error(`Gemini live session ${eventName}`, event);
    };

    const openSession = async (resumeHandle?: string) => {
      let isWsConnectedOrAttempted = false;
      try {
        const activeSession = initialSessionUsedRef.current
          ? await createRealtimeSession({
              username: config?.credentials?.username,
              phone,
              chatbotAgentId,
            })
          : session;
        initialSessionUsedRef.current = true;

        if (cancelled) return;

        const { ephemeral_token, model, instructions, tools } = activeSession;
        const mergedTools = [...(tools || [])];
        toolsRef.current = mergedTools;

        const functionDeclarations = mergedTools
          .filter((tool) => tool?.name)
          .map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          }));

        const ai = new GoogleGenAI({
          apiKey: ephemeral_token,
          httpOptions: { apiVersion: "v1alpha" },
        });

        const liveConfig: LiveConnectConfig = {
          responseModalities: [Modality.AUDIO],
          ...(instructions && { systemInstruction: { parts: [{ text: instructions }] } }),
          ...(functionDeclarations.length > 0 && { tools: [{ functionDeclarations }] }),
          ...(resolveGeminiVoice(voiceName) && {
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: resolveGeminiVoice(voiceName) } },
            },
          }),
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          contextWindowCompression: { slidingWindow: {} },
          sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
        };

        isWsConnectedOrAttempted = true;
        const liveSession = await ai.live.connect({
          model: model || DEFAULT_LIVE_MODEL,
          config: liveConfig,
          callbacks: {
            onopen: () => {
              if (cancelled) return;
              if (stabilizeTimer) clearTimeout(stabilizeTimer);
              stabilizeTimer = setTimeout(() => {
                reconnectAttempts = 0;
              }, RECONNECT_STABLE_MS);
              setIsConnecting(false);
              setIsCallActive(true);
              setAiStatus("listening");

              if (!isRecordingStartedRef.current && userMediaRef.current) {
                isRecordingStartedRef.current = true;
                void startRecording(userMediaRef.current);
              }
            },
            onmessage: handleMessage,
            onerror: (e) => {
              logGeminiSessionEvent("error", e, { message: (e as ErrorEvent)?.message });
            },
            onclose: (e) => {
              if (stabilizeTimer) {
                clearTimeout(stabilizeTimer);
                stabilizeTimer = null;
              }
              if (cancelled || isHangingUpRef.current) return;
              logGeminiSessionEvent("closed", e, {
                code: e?.code,
                reason: e?.reason,
                wasClean: e?.wasClean,
                reconnectAttempts,
              });
              geminiSessionRef.current = null;
              if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                setIsCallActive(false);
                setIsConnecting(false);
                setAiStatus("idle");
                setCallFailed(true);
                return;
              }
              reconnectAttempts += 1;
              setIsConnecting(true);
              setTimeout(() => {
                if (!cancelled && !isHangingUpRef.current) {
                  void openSession(sessionResumptionHandleRef.current).catch(() => {});
                }
              }, 3000);
            },
          },
        });

        if (cancelled) {
          liveSession.close();
          return;
        }

        geminiSessionRef.current = liveSession;

        // Trigger greeting on initial connection, not on session resumption
        if (!resumeHandle) {
          try {
            liveSession.sendClientContent({
              turns: [
                {
                  role: "user",
                  parts: [{ text: "Halo" }],
                },
              ],
              turnComplete: true,
            });
          } catch (error) {
            console.error("Failed to send greeting:", error);
          }
        }
      } catch (error) {
        if (cancelled || isHangingUpRef.current) return;
        if (isWsConnectedOrAttempted) {
          // The onclose callback will handle the retry if WebSocket connection failed/closed.
          return;
        }
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          setIsCallActive(false);
          setIsConnecting(false);
          setAiStatus("idle");
          setCallFailed(true);
          return;
        }
        reconnectAttempts += 1;
        setIsConnecting(true);
        setTimeout(() => {
          if (!cancelled && !isHangingUpRef.current) {
            void openSession(resumeHandle).catch(() => {});
          }
        }, 3000);
      }
    };

    const setupMicPipeline = (micStream: MediaStream) => {
      const inputCtx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      inputAudioContextRef.current = inputCtx;

      const micSource = inputCtx.createMediaStreamSource(micStream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const activeSession = geminiSessionRef.current;
        if (!activeSession || isMutedRef.current || isProcessingRef.current) return;
        const base64Audio = floatToBase64PCM16(event.inputBuffer.getChannelData(0));
        try {
          activeSession.sendRealtimeInput({
            audio: { data: base64Audio, mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
          });
        } catch (error) {}
      };

      micSource.connect(processor);
      const silentGain = inputCtx.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(inputCtx.destination);
    };

    (async () => {
      try {
        const outputCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
        outputAudioContextRef.current = outputCtx;
        outputDestinationRef.current = outputCtx.createMediaStreamDestination();
        nextPlayTimeRef.current = 0;
        setAiMediaStream(outputDestinationRef.current.stream);

        const micStream = await ensureMicStream();
        if (cancelled) return;

        await openSession();
        if (cancelled) return;

        setupMicPipeline(micStream);
      } catch (error) {
        if (!cancelled) {
          setIsConnecting(false);
          setAiStatus("idle");
          setCallFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelledRef.current = true;

      if (stabilizeTimer) clearTimeout(stabilizeTimer);

      stopPlayback();

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      } else {
        releaseRecordingResources();
      }

      scriptProcessorRef.current?.disconnect();
      scriptProcessorRef.current = null;

      geminiSessionRef.current?.close();
      geminiSessionRef.current = null;

      userMediaRef.current?.getTracks().forEach((track) => track.stop());
      userMediaRef.current = null;

      if (inputAudioContextRef.current && inputAudioContextRef.current.state !== "closed") {
        void inputAudioContextRef.current.close().catch(() => {});
      }
      inputAudioContextRef.current = null;

      if (outputAudioContextRef.current && outputAudioContextRef.current.state !== "closed") {
        void outputAudioContextRef.current.close().catch(() => {});
      }
      outputAudioContextRef.current = null;
      outputDestinationRef.current = null;

      setIsCallActive(false);
      setElapsedSeconds(0);
      setAiStatus("idle");
    };
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
  }, [recordingUrl]);

  const handleHangUp = () => {
    setIsAnimating(true);
    isHangingUpRef.current = true;
    setTimeout(() => {
      if (isRecording) stopRecording();
      geminiSessionRef.current?.close();
      geminiSessionRef.current = null;

      setIsCallActive(false);
      setElapsedSeconds(0);
      setIsMuted(false);
      isMutedRef.current = false;
      setIsConnecting(true);
      setAiMediaStream(null);
      onToggleCallWindow();
      setIsAnimating(false);
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <motion.div
      className="mimin:absolute mimin:inset-0 mimin:bg-white mimin:z-10"
      initial={false}
      animate="visible"
      exit="exit"
      // @ts-ignore
      variants={containerVariants}
    >
      <div className="mimin:h-full mimin:p-4 mimin:sm:p-10 mimin:overflow-y-auto">
        <div className="mimin:flex mimin:h-full mimin:flex-col mimin:items-center mimin:justify-center">
          <motion.h4
            className="mimin:text-[#0096a2] mimin:text-xl mimin:font-bold mimin:mb-6"
            variants={blinkingTextVariants}
            initial="initial"
            animate="animate"
          >
            {callFailed ? "CALL FAILED" : isConnecting ? "CONNECTING..." : "IN CALL"}
          </motion.h4>

          {callFailed && (
            <p className="mimin:text-[#f26075] mimin:text-sm mimin:font-medium mimin:mb-4 mimin:text-center mimin:max-w-xs">
              Gagal terhubung. Silakan tutup dan coba lagi.
            </p>
          )}

          <div className="mimin:relative">
            <motion.div
              className="mimin:flex mimin:items-center mimin:justify-center mimin:p-4 mimin:rounded-full mimin:w-[204px] mimin:h-[204px] mimin:bg-gradient-to-br mimin:from-[#0096a2]/30 mimin:to-[#f26075]/30"
              // @ts-ignore
              variants={audioCircleVariants}
              initial="initial"
              animate="animate"
            >
              <motion.div
                className="mimin:flex mimin:items-center mimin:justify-center mimin:p-4 mimin:rounded-full mimin:w-full mimin:h-full mimin:bg-gradient-to-br mimin:from-[#0096a2]/40 mimin:to-[#f26075]/40"
                animate={{
                  scale: [1, 1.02, 1],
                  transition: { duration: 1.8, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 0.2 },
                }}
              >
                <motion.div
                  className="mimin:flex mimin:items-center mimin:justify-center mimin:p-4 mimin:rounded-full mimin:w-full mimin:h-full mimin:bg-gradient-to-br mimin:from-[#0096a2]/50 mimin:to-[#f26075]/50"
                  animate={{
                    scale: [1, 1.03, 1],
                    transition: { duration: 1.6, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 0.4 },
                  }}
                />
              </motion.div>
            </motion.div>
            <div className="mimin:absolute mimin:inset-0 mimin:flex mimin:justify-center mimin:items-center">
              <AudioVisualizer audioStream={aiMediaStream} isActive={isVisible} />
            </div>
            {!!aiMediaStream && (
              <div className="mimin:absolute mimin:text-white mimin:text-xs mimin:capitalize mimin:tracking-wide mimin:bottom-[25%] mimin:left-[50%] mimin:-translate-x-[50%] mimin:mt-4 mimin:animate-pulse">
                {aiStatus}
              </div>
            )}
          </div>

          <motion.p
            className="mimin:text-[#0096a2] mimin:text-base mimin:font-bold mimin:mt-5"
            // @ts-ignore
            variants={childVariants}
          >
            {config?.theme?.chatWindow?.header?.title || "AI Assistant"}
          </motion.p>

          <motion.p
            className="mimin:text-[#0096a2] mimin:text-sm mimin:font-medium mimin:mt-0"
            // @ts-ignore
            variants={childVariants}
            key={time}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {time}
          </motion.p>

          <motion.div
            className="mimin:h-[1.5px] mimin:w-full mimin:bg-gray-200 mimin:my-6"
            // @ts-ignore
            variants={dividerVariants}
            initial="initial"
            animate="animate"
          />

          <motion.div
            className="mimin:flex mimin:items-center mimin:justify-center mimin:gap-8 mimin:w-full"
            // @ts-ignore
            variants={childVariants}
          >
            <motion.button
              type="button"
              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
              className={`mimin:rounded-full mimin:w-[60px] mimin:h-[60px] mimin:p-4 mimin:flex mimin:items-center mimin:justify-center mimin:transition-colors ${
                isMuted
                  ? "mimin:bg-[#f26075] mimin:text-white"
                  : isConnecting || isProcessing
                    ? "mimin:bg-gray-100 mimin:text-gray-300 mimin:cursor-not-allowed"
                    : "mimin:bg-gray-100 mimin:text-[#0096a2] mimin:cursor-pointer"
              }`}
              // @ts-ignore
              variants={hangUpButtonVariants}
              initial="initial"
              whileHover="hover"
              whileTap="tap"
              onClick={toggleMute}
              disabled={isAnimating || isConnecting || isProcessing}
            >
              {isMuted ? <MdMicOff className="mimin:w-full mimin:h-full" /> : <MdMic className="mimin:w-full mimin:h-full" />}
            </motion.button>

            <motion.button
              type="button"
              aria-label="End call"
              className={`mimin:rounded-full mimin:w-[60px] mimin:h-[60px] mimin:p-4 mimin:aspect-square mimin:flex mimin:items-center mimin:justify-center mimin:transition-opacity ${
                isConnecting
                  ? "mimin:bg-gradient-to-br mimin:from-[#0096a2]/10 mimin:to-[#f26075]/10 mimin:cursor-not-allowed mimin:opacity-50"
                  : "mimin:bg-gradient-to-br mimin:from-[#0096a2]/30 mimin:to-[#f26075]/30 mimin:cursor-pointer"
              }`}
              // @ts-ignore
              variants={hangUpButtonVariants}
              initial="initial"
              whileHover="hover"
              whileTap="tap"
              onClick={handleHangUp}
              disabled={isAnimating}
              animate={
                isAnimating ? { scale: [1, 1.2, 0.8], rotate: [0, 180, 360], transition: { duration: 0.3 } } : {}
              }
            >
              <MdPhone className="mimin:w-full mimin:h-full mimin:text-[#f26075]/90 mimin:rotate-90" />
            </motion.button>
          </motion.div>

          <motion.div
            className="mimin:absolute mimin:inset-0 mimin:pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="mimin:absolute mimin:top-1/2 mimin:left-1/2 mimin:w-4 mimin:h-4 mimin:bg-[#0096a2]/10 mimin:rounded-full"
                style={{
                  transform: "translate(-50%, -50%)",
                }}
                animate={{ scale: [0, 20, 0], opacity: [0, 0.3, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: "easeOut" }}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
