import { useConfigStore } from "../../hooks/config-store";

interface IProps {
  onClickStartChat: () => void;
}

export const StartChatSection = ({ onClickStartChat }: IProps) => {
  const { config } = useConfigStore();

  return (
    <div
      className="mimin:h-full mimin:overflow-y-auto"
      style={{
        backgroundColor: config?.theme?.chatWindow.greating?.color || "#0096A2",
      }}
    >
      <div className="mimin:px-4 mimin:sm:px-10 mimin:flex mimin:flex-col mimin:justify-between mimin:h-full mimin:overflow-y-auto mimin:max-w-4xl mimin:mx-auto">
        <div className="mimin:flex mimin:flex-col mimin:items-center mimin:justify-center mimin:mt-32">
          <h2
            className="mimin:text-2xl mimin:font-bold"
            style={{
              color: config?.theme?.button?.textColor || "#ffffff",
            }}
          >
            {config?.theme?.chatWindow?.header?.title}
          </h2>
          <img
            src={
              config?.theme?.chatWindow?.greating?.avatar ||
              "https://res.cloudinary.com/dctqloe37/image/upload/v1752571979/Icon_AI_Agent_lrdrhr.png"
            }
            alt=" "
            width={1000}
            height={1000}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src =
                "https://res.cloudinary.com/dctqloe37/image/upload/v1752571979/Icon_AI_Agent_lrdrhr.png";
            }}
            className="mimin:w-40 mimin:h-40 mimin:rounded-full mimin:mt-6"
          />
        </div>
        <div className="mimin:flex mimin:flex-col mimin:items-center mimin:justify-center mimin:px-6 mimin:py-10 mimin:rounded-t-3xl mimin:mt-6 mimin:bg-white mimin:h-max">
          <h3
            className="mimin:text-2xl mimin:font-bold mimin:text-center mimin:px-8"
            style={{
              color: config?.theme?.chatWindow.greating?.color || "#0096A2",
            }}
          >
            {config?.theme?.chatWindow?.greating?.title}
          </h3>
          <p
            className="mimin:text-lg mimin:text-center mimin:mt-7 mimin:mb-7"
            style={{
              color: config?.theme?.chatWindow.greating?.color || "#0096A2",
            }}
          >
            {config?.theme?.chatWindow?.greating?.description}
          </p>
          <button
            onClick={() => {
              localStorage.setItem(`cu-greeting-${config?.credentials?.username}`, 'true');
              onClickStartChat();
            }}
            className="mimin:text-white mimin:px-4 mimin:py-2 mimin:rounded-md mimin:cursor-pointer mimin:disabled:opacity-50 mimin:disabled:cursor-not-allowed"
            style={{
              backgroundColor:
                config?.theme?.chatWindow.greating?.color || "#0096A2",
              color: config?.theme?.button?.textColor || "#ffffff",
            }}
          >
            Start Chat
          </button>
        </div>
      </div>
    </div>
  );
};
