import React, { useState, useEffect, useRef } from "react";
import { MdPhone } from "react-icons/md";
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
import { blobToBase64, formatAudioCurrentTime, getApiErrorMessage } from "../../utils";

interface OpenAiAgentVoiceProps {
  isVisible: boolean;
  onToggleCallWindow: () => void;
}

export const OpenAiAgentVoiceLayout: React.FC<OpenAiAgentVoiceProps> = ({
  isVisible,
  onToggleCallWindow,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [time, setTime] = useState("00:00:00");
  const [callError, setCallError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [aiMediaStream, setAiMediaStream] = useState<MediaStream | null>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "listening" | "speaking">(
    "idle"
  );

  const { config, signature } = useConfigStore();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const userMediaRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      userMediaRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const userSource = audioContext.createMediaStreamSource(userMediaRef.current);
      userSource.connect(destination);

      if (audioRef.current && audioRef.current.srcObject) {
        const aiStream = audioRef.current.srcObject as MediaStream;
        const aiSource = audioContext.createMediaStreamSource(aiStream);
        aiSource.connect(destination);
      }

      recordingStreamRef.current = destination.stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      mediaRecorderRef.current = new MediaRecorder(destination.stream, {
        mimeType
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
        const response = await API('axios', 'customer')({
          url: `/v1/call-session/create-draft/${config?.credentials?.username}`,
          method: 'POST',
          data: { phone_number: ip },
          headers: { "x-api-key": config?.credentials?.apiKey }
        });
        if (response.data?.session_id._id) setSessionId(response.data.session_id._id);
      }
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach(track => track.stop());
      }

      if (userMediaRef.current) {
        userMediaRef.current.getTracks().forEach(track => track.stop());
        userMediaRef.current = null;
      }

      if (sessionId) {
        mediaRecorderRef.current.onstop = async () => {
          const mimeType = MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/mp4';
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          setRecordingUrl(URL.createObjectURL(blob));

          try {
            const base64 = await blobToBase64(blob);
            await API('axios', 'customer')({
              url: `/v1/call-session/update/${config?.credentials?.username}/${sessionId}`,
              method: 'POST',
              data: { audio_base64: base64 },
              headers: { "x-api-key": config?.credentials?.apiKey }
            });
            setSessionId(null);
          } catch (err) {
            console.error('Failed to upload recording:', err);
          }
        };
      }
    }
  };

  useEffect(() => {
    let mediaStream: MediaStream | null = null;
    let peerConnection: RTCPeerConnection | null = null;

    if (isVisible) {
      (async () => {
        try {
          setCallError(null);

          peerConnection = new RTCPeerConnection();

          const sessionRes = await API("axios", "customer")(
            `/v1/call-session/create-realtime-session/${config?.credentials?.username}`,
            {
              method: "POST",
              headers: {
                "x-api-key": config?.credentials?.apiKey
              }
            }
          );

          const { client_secret, model, instructions } = sessionRes.data;

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
                  tools: [],
                },
              })
            );
          };

          dataChannel.addEventListener("message", (event) => {
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
              default:
                break;
            }
          });

          dataChannel.addEventListener("open", async () => {
            configureData();
            startRecording();

            const startConversation = {
              type: "response.create",
              response: {
                instructions: instructions,
              },
            };

            dataChannel.send(JSON.stringify(startConversation));
          });

          navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
            mediaStream = stream;

            stream
              .getTracks()
              .forEach((track) =>
                peerConnection!.addTransceiver(track, { direction: "sendrecv" })
              );

            peerConnection!.createOffer().then((offer) => {
              peerConnection!.setLocalDescription(offer);

              API("fetch", "openai")(`/realtime?model=${model}`, {
                method: "POST",
                body: offer.sdp,
                headers: {
                  Authorization: `Bearer ${client_secret.value}`,
                  "Content-Type": "application/sdp",
                },
                // @ts-expect-error: fetch support duplex property
                duplex: "half",
              })
                .then((r) => r.text())
                .then((sdp) => {
                  peerConnection!.setRemoteDescription({
                    sdp,
                    type: "answer",
                  });
                })
                .catch((err) => console.error(err));
            });
          });
        } catch (error) {
          console.error("Failed to create realtime session:", error);
          setCallError(getApiErrorMessage(error, "Gagal membuat sesi realtime"));
        }
      })();

      return () => {
        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => track.stop());
        }

        if (peerConnection) {
          peerConnection.getSenders().forEach((sender) => sender.track?.stop());
          peerConnection.close();
        }
      };
    }
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
  }, [recordingUrl]);

  // Animasi untuk tombol hang up
  const handleHangUp = () => {
    setIsAnimating(true);
    setTimeout(() => {
      if (isRecording) stopRecording();

      if (audioRef.current) {
        setTime("00:00:00");
        audioRef.current.pause();
      }

      setAiMediaStream(null);
      setCallError(null);
      onToggleCallWindow();
      setIsAnimating(false);
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <motion.div
      className="mimin:absolute mimin:inset-0 mimin:bg-white mimin:z-10"
      initial="hidden"
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
            {callError ? "CALL FAILED" : "IN CALL"}
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
                isActive={isVisible}
              />
            </div>
            {!!aiMediaStream && (
              <div className="mimin:absolute mimin:text-white mimin:text-xs mimin:capitalize mimin:tracking-wide mimin:bottom-[25%] mimin:left-[50%] mimin:-translate-x-[50%] mimin:mt-4 mimin:animate-pulse">
                {aiStatus}
              </div>
            )}
          </div>

          {callError && (
            <motion.p
              className="mimin:mt-4 mimin:px-3 mimin:py-2 mimin:rounded-lg mimin:bg-red-50 mimin:text-red-600 mimin:text-xs mimin:text-center mimin:max-w-[280px] mimin:break-words"
              // @ts-ignore
              variants={childVariants}
            >
              {callError}
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

          {/* Tombol hang up dengan animasi interaktif */}
          <motion.div
            className="mimin:grid mimin:grid-cols-2 mimin:gap-4 mimin:w-full"
            // @ts-ignore
            variants={childVariants}
          >
            <div className="mimin:col-span-2 mimin:flex mimin:items-center mimin:justify-center">
              <motion.button
                type="button"
                className="mimin:cursor-pointer mimin:bg-gradient-to-br mimin:from-[#0096a2]/30 mimin:to-[#f26075]/30 mimin:rounded-full mimin:w-[60px] mimin:h-[60px] mimin:p-4 mimin:aspect-square mimin:flex mimin:items-center mimin:justify-center"
                // @ts-ignore
                variants={hangUpButtonVariants}
                initial="initial"
                whileHover="hover"
                whileTap="tap"
                onClick={handleHangUp}
                disabled={isAnimating}
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
            </div>
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
