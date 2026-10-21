import React, { useState, useEffect, useRef } from "react";
import { MdPhone, MdMic, MdMicOff } from "react-icons/md";
import { motion } from "framer-motion";
import {
  audioCircleVariants,
  blinkingTextVariants,
  childVariants,
  containerVariants,
  dividerVariants,
  hangUpButtonVariants,
} from "./animate";
import { OpenAIAudioVisualizer } from "./openai-audio-visualizer";
import { useConfigStore } from "../../hooks/config-store";
import { API, getClientInfo } from "../../services";
import {
  blobToBase64,
  executeToolCall,
  formatAudioCurrentTime,
  getApiErrorMessage,
} from "../../utils";
import type { RealtimeSession } from "../../types";

const REALTIME_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
];

const resolveRealtimeVoice = (voiceName?: string): string | undefined => {
  if (!voiceName) return undefined;
  const normalized = voiceName.toLowerCase().trim();
  return REALTIME_VOICES.includes(normalized) ? normalized : undefined;
};

interface OpenAiAgentVoiceProps {
  isVisible: boolean;
  onToggleCallWindow: () => void;
  phone: string;
  chatbotAgentId?: string;
  voiceName?: string;
  session: RealtimeSession;
}

export const OpenAiAgentVoiceLayout: React.FC<OpenAiAgentVoiceProps> = ({
  isVisible,
  onToggleCallWindow,
  phone,
  chatbotAgentId,
  voiceName,
  session,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [time, setTime] = useState("00:00:00");
  const [callError, setCallError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callFailed, setCallFailed] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [aiMediaStream, setAiMediaStream] = useState<MediaStream | null>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "listening" | "speaking" | "processing">(
    "idle"
  );

  const { config } = useConfigStore();
  const apiKey = config?.credentials?.apiKey || "";

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const userMediaRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const toolsRef = useRef<RealtimeSession["tools"]>([]);
  const isMutedRef = useRef(false);

  const startRecording = async () => {
    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      if (!userMediaRef.current) {
        userMediaRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      userMediaRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMutedRef.current;
      });
      const userSource = audioContext.createMediaStreamSource(userMediaRef.current);
      userSource.connect(destination);

      if (audioRef.current && audioRef.current.srcObject) {
        const aiStream = audioRef.current.srcObject as MediaStream;
        const aiSource = audioContext.createMediaStreamSource(aiStream);
        aiSource.connect(destination);
      }

      recordingStreamRef.current = destination.stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      mediaRecorderRef.current = new MediaRecorder(destination.stream, {
        mimeType,
      });

      recordedChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      const { isError, ip } = await getClientInfo();

      if (!isError) {
        const response = await API("axios", "customer")(
          `/v1/call-session/create-draft/${config?.credentials?.username}`,
          {
            method: "POST",
            data: {
              phone_number: phone || ip,
              ...(chatbotAgentId && { chatbot_agent: chatbotAgentId }),
            },
            headers: { "x-api-key": apiKey },
          }
        );
        if (response.data?.session_id?._id) setSessionId(response.data.session_id._id);
      }
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (userMediaRef.current) {
        userMediaRef.current.getTracks().forEach((track) => track.stop());
        userMediaRef.current = null;
      }

      if (sessionId) {
        mediaRecorderRef.current.onstop = async () => {
          const mimeType = MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "audio/mp4";
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          setRecordingUrl(URL.createObjectURL(blob));

          try {
            const base64 = await blobToBase64(blob);
            await API("axios", "customer")(
              `/v1/call-session/update/${config?.credentials?.username}/${sessionId}`,
              {
                method: "POST",
                data: { audio_base64: base64 },
                headers: { "x-api-key": apiKey },
              }
            );
            setSessionId(null);
          } catch (err) {
            console.error("Failed to upload recording:", err);
          }
        };
      }
    }
  };

  const toggleMute = () => {
    const newMuteState = !isMuted;
    peerConnectionRef.current?.getSenders().forEach((sender) => {
      if (sender.track?.kind === "audio") {
        sender.track.enabled = !newMuteState;
      }
    });
    userMediaRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !newMuteState;
    });
    isMutedRef.current = newMuteState;
    setIsMuted(newMuteState);
  };

  useEffect(() => {
    let mediaStream: MediaStream | null = null;
    let peerConnection: RTCPeerConnection | null = null;
    let active = true;

    if (isVisible && session) {
      (async () => {
        try {
          setCallError(null);
          setCallFailed(false);
          setIsConnecting(true);

          const { model, instructions, tools } = session;
          toolsRef.current = tools || [];

          const openAITools = toolsRef.current.map((tool) => ({
            type: "function",
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          }));

          const realtimeVoice = resolveRealtimeVoice(voiceName);

          peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });
          peerConnectionRef.current = peerConnection;

          peerConnection.onconnectionstatechange = () => {
            if (peerConnection?.connectionState === "failed" && active) {
              setCallFailed(true);
              setIsConnecting(false);
            }
          };

          peerConnection.ontrack = (event: RTCTrackEvent) => {
            if (audioRef.current) {
              setAiMediaStream(event.streams[0]);
              audioRef.current.srcObject = event.streams[0];
              audioRef.current.play();
            }
          };

          const dataChannel = peerConnection.createDataChannel("response");

          const configureData = () => {
            dataChannel.send(
              JSON.stringify({
                type: "session.update",
                session: {
                  modalities: ["text", "audio"],
                  tools: openAITools,
                  ...(realtimeVoice && { voice: realtimeVoice }),
                },
              })
            );
          };

          dataChannel.addEventListener("message", async (event) => {
            const message = JSON.parse(event.data);

            switch (message.type) {
              case "output_audio_buffer.started":
                setAiStatus("speaking");
                break;
              case "output_audio_buffer.stopped":
                setAiStatus("idle");
                break;
              case "input_audio_buffer.speech_started":
                setAiStatus("listening");
                break;
              case "response.function_call_arguments.done": {
                setAiStatus("processing");
                try {
                  const toolName: string = message.name;
                  const toolArgs = JSON.parse(message.arguments || "{}");
                  const toolResult = await executeToolCall(
                    toolsRef.current || [],
                    toolName,
                    toolArgs
                  );
                  if (!active) break;
                  dataChannel.send(
                    JSON.stringify({
                      type: "conversation.item.create",
                      item: {
                        type: "function_call_output",
                        call_id: message.call_id,
                        output: JSON.stringify(toolResult),
                      },
                    })
                  );
                  dataChannel.send(JSON.stringify({ type: "response.create" }));
                } catch (error) {
                  console.error("Tool call failed:", error);
                } finally {
                  if (active) setAiStatus("idle");
                }
                break;
              }
              default:
                break;
            }
          });

          dataChannel.addEventListener("open", async () => {
            if (!active) return;
            setIsConnecting(false);
            configureData();
            await startRecording();

            const startConversation = {
              type: "response.create",
              response: {
                instructions: instructions,
              },
            };

            dataChannel.send(JSON.stringify(startConversation));
          });

          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          userMediaRef.current = userMediaRef.current || mediaStream;
          if (!active) return;

          mediaStream
            .getTracks()
            .forEach((track) =>
              peerConnection!.addTransceiver(track, { direction: "sendrecv" })
            );

          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          if (!active) return;

          const sdpUrl = `/v1/internal/openai-realtime/${config?.credentials?.username}?model=${model}${
            chatbotAgentId ? `&chatbot_agent=${chatbotAgentId}` : ""
          }`;

          const sdpRes = await API("fetch", "customer")(sdpUrl, {
            method: "POST",
            body: offer.sdp,
            headers: {
              "Content-Type": "application/sdp",
              "x-api-key": apiKey,
            },
            // @ts-expect-error: fetch support duplex property
            duplex: "half",
          });

          if (!sdpRes.ok) {
            const body = await sdpRes.text().catch(() => "");
            throw new Error(body || "SDP exchange failed");
          }

          const sdp = await sdpRes.text();
          if (!active) return;

          await peerConnection.setRemoteDescription({
            sdp,
            type: "answer",
          });
        } catch (error) {
          if (!active) return;
          console.error("Failed to start realtime call:", error);
          setCallError(getApiErrorMessage(error, ""));
          setCallFailed(true);
          setIsConnecting(false);
        }
      })();
    }

    return () => {
      active = false;

      if (peerConnectionRef.current === peerConnection) {
        peerConnectionRef.current = null;
      }

      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }

      if (userMediaRef.current) {
        userMediaRef.current.getTracks().forEach((track) => track.stop());
        userMediaRef.current = null;
      }

      if (peerConnection) {
        peerConnection.getSenders().forEach((sender) => sender.track?.stop());
        peerConnection.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, session]);

  useEffect(() => {
    return () => {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
  }, [recordingUrl]);

  const handleHangUp = () => {
    setIsAnimating(true);
    setTimeout(() => {
      if (isRecording) stopRecording();

      if (audioRef.current) {
        setTime("00:00:00");
        audioRef.current.pause();
      }

      setAiMediaStream(null);
      setAiStatus("idle");
      setIsMuted(false);
      isMutedRef.current = false;
      setIsConnecting(true);
      setCallFailed(false);
      setCallError(null);
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
      <div className="mimin:h-full mimin:px-6 mimin:py-10 mimin:overflow-y-auto">
        <div className="mimin:flex mimin:flex-col mimin:items-center mimin:justify-center">
          {/* Header dengan animasi berkedip */}
          <motion.h4
            className="mimin:text-[#0096a2] mimin:text-xl mimin:font-bold mimin:mb-6"
            variants={blinkingTextVariants}
            initial="initial"
            animate="animate"
          >
            {callFailed ? "CALL FAILED" : isConnecting ? "CONNECTING..." : "IN CALL"}
          </motion.h4>

          {/* Lingkaran audio dengan animasi berlapis */}
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
                  transition: {
                    duration: 1.8,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut",
                    delay: 0.2,
                  },
                }}
              >
                <motion.div
                  className="mimin:flex mimin:items-center mimin:justify-center mimin:p-4 mimin:rounded-full mimin:w-full mimin:h-full mimin:bg-gradient-to-br mimin:from-[#0096a2]/50 mimin:to-[#f26075]/50"
                  animate={{
                    scale: [1, 1.03, 1],
                    transition: {
                      duration: 1.6,
                      repeat: Infinity,
                      repeatType: "reverse",
                      ease: "easeInOut",
                      delay: 0.4,
                    },
                  }}
                />
              </motion.div>
            </motion.div>
            <div className="mimin:absolute mimin:inset-0 mimin:flex mimin:justify-center mimin:items-center">
              <OpenAIAudioVisualizer
                audioStream={aiMediaStream}
                isActive={isVisible && !isConnecting && !callFailed}
              />
            </div>
            {!!aiMediaStream && (
              <div className="mimin:absolute mimin:text-white mimin:text-xs mimin:capitalize mimin:tracking-wide mimin:bottom-[25%] mimin:left-[50%] mimin:-translate-x-[50%] mimin:mt-4 mimin:animate-pulse">
                {aiStatus}
              </div>
            )}
          </div>

          {callFailed && (
            <motion.p
              className="mimin:mt-4 mimin:px-3 mimin:py-2 mimin:rounded-lg mimin:bg-red-50 mimin:text-red-600 mimin:text-xs mimin:text-center mimin:max-w-[280px] mimin:break-words"
              // @ts-ignore
              variants={childVariants}
            >
              {callError || "Gagal terhubung. Silakan tutup dan coba lagi."}
            </motion.p>
          )}

          {/* Nama AI dengan animasi slide up */}
          <motion.p
            className="mimin:text-[#0096a2] mimin:text-base mimin:font-bold mimin:mt-5"
            // @ts-ignore
            variants={childVariants}
          >
            MIMIN AI
          </motion.p>

          {/* Timer dengan animasi counter */}
          <motion.p
            className="mimin:text-[#0096a2] mimin:text-sm mimin:font-medium mimin:mt-0"
            // @ts-ignore
            variants={childVariants}
            key={time} // Key berubah untuk trigger animasi
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {time}
          </motion.p>

          {/* Divider dengan animasi expand */}
          <motion.div
            className="mimin:h-[1.5px] mimin:w-full mimin:bg-gray-200 mimin:my-6"
            // @ts-ignore
            variants={dividerVariants}
            initial="initial"
            animate="animate"
          />

          <audio
            ref={audioRef}
            className="mimin:hidden"
            controls
            autoPlay={false}
            onTimeUpdate={(e) => {
              // @ts-expect-error: audio support currentTime property
              setTime(formatAudioCurrentTime(e.target.currentTime));
            }}
          />

          {/* Tombol mute dan hang up dengan animasi interaktif */}
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
                  : isConnecting
                    ? "mimin:bg-gray-100 mimin:text-gray-300 mimin:cursor-not-allowed"
                    : "mimin:bg-gray-100 mimin:text-[#0096a2] mimin:cursor-pointer"
              }`}
              // @ts-ignore
              variants={hangUpButtonVariants}
              initial="initial"
              whileHover="hover"
              whileTap="tap"
              onClick={toggleMute}
              disabled={isAnimating || isConnecting}
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
              disabled={isAnimating || isConnecting}
              animate={
                isAnimating
                  ? {
                    scale: [1, 1.2, 0.8],
                    rotate: [0, 180, 360],
                    transition: { duration: 0.3 },
                  }
                  : {}
              }
            >
              <MdPhone className="mimin:w-full mimin:h-full mimin:text-[#f26075]/90 mimin:rotate-90" />
            </motion.button>
          </motion.div>

          {/* Ripple effect untuk background */}
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
                animate={{
                  scale: [0, 20, 0],
                  opacity: [0, 0.3, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 1,
                  ease: "easeOut",
                }}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
