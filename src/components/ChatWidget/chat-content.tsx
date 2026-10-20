import React from "react";
import type { Interaction } from "../../types";
import BubbleChat from "./bubble-chat";

export const ChatContent: React.FC<{
  messages: Interaction[];
  currentResponseMsg: string;
  loading: boolean;
  fetching: boolean;
  isWebsite?: boolean;
  sessionActive?: boolean;
}> = ({ messages, currentResponseMsg, loading, fetching, isWebsite, sessionActive }) => {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Scroll to the bottom whenever messages change
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 200);
  }, [currentResponseMsg, messages.length]);

  return (
    <div
      className="mimin:relative mimin:flex-1 mimin:h-full mimin:px-4 mimin:py-6 mimin:max-h-full mimin:overflow-y-scroll"
      style={{ overflowAnchor: "none" }}
    >
      <div className="mimin:flex mimin:flex-col mimin:gap-9">
        <div className="mimin:flex mimin:flex-col-reverse mimin:gap-9">
          {messages.map((msg, index) => (
            <div key={index} className="mimin:flex mimin:flex-col mimin:gap-6">
              {msg.human && (msg.human.content || (msg.human.media && msg.human.media.length > 0)) && (
                <BubbleChat
                  message={msg.human.content}
                  media={msg.human.media}
                  isUser={true}
                  date={msg.date}
                  isError={msg.human.isError}
                />
              )}
              {msg.ai && (msg.ai.content || (msg.ai.media && msg.ai.media.length > 0)) && (
                <BubbleChat
                  message={msg.ai.content}
                  media={msg.ai.media}
                  isUser={false}
                  date={msg.date}
                  isError={msg.ai.isError}
                />
              )}
            </div>
          ))}
        </div>
        {!fetching &&
          currentResponseMsg &&
          messages.length > 0 &&
          !messages[0]?.ai && (
            <BubbleChat
              message={currentResponseMsg}
              isUser={false}
              date={new Date()}
            />
          )}
        {loading && !currentResponseMsg && !isWebsite && (
          <BubbleChat thinking={true} date={new Date()} />
        )}
        {!sessionActive && !loading && !fetching && (
          <div className="mimin:flex mimin:flex-col mimin:items-center mimin:gap-2 mimin:py-4 mimin:px-3 mimin:bg-amber-50 mimin:border mimin:border-amber-200 mimin:rounded-lg mimin:text-center">
            <svg className="mimin:w-5 mimin:h-5 mimin:text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="mimin:text-sm mimin:text-amber-700 mimin:font-medium">Sesi ini sudah berakhir</p>
            <p className="mimin:text-xs mimin:text-amber-600">Kirim pesan untuk memulai sesi baru</p>
          </div>
        )}
      </div>
      <div ref={bottomRef} id="bottom-ref" className="mimin:pb-9" />
    </div>
  );
};
