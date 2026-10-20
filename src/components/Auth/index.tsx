import { useState } from "react";
import LoginSection from "./login-section";
import RegisterSection from "./register-section";
import { useConfigStore } from "../../hooks/config-store";
import { cn } from "../../utils";

interface IProps {
  onSuccessLogin: (token: string, phone: { phone: string; value: string }) => void;
  token: string;
  sessionExpired?: boolean;
}

function AuthWindow({ onSuccessLogin, token, sessionExpired }: IProps) {
  const [step, setStep] = useState<"landing-section" | "sign-in" | "create-account">("landing-section");
  const { config } = useConfigStore();

  return (
    <div
      className="mimin:w-full mimin:p-2 mimin:h-full mimin:flex mimin:flex-col mimin:justify-center mimin:items-center"
      style={{ backgroundColor: config?.theme?.chatWindow.greating?.color }}
    >
      <div className={cn(
        "mimin:max-w-xl mimin:max-h-[700px] mimin:overflow-y-auto mimin:mx-auto mimin:bg-white mimin:rounded-lg mimin:shadow-lg", 
        ["sign-in", "create-account", "landing-section"].includes(step) ? "mimin:p-4 sm:mimin:p-4" : "mimin:p-4 sm:mimin:p-10"
      )}>
        {sessionExpired && (
          <div className="mimin:w-full mimin:mb-4 mimin:px-3 mimin:py-2 mimin:bg-amber-50 mimin:border mimin:border-amber-200 mimin:rounded-lg mimin:text-center">
            <p className="mimin:text-xs mimin:text-amber-700 mimin:font-medium">
              Your session has expired. Please sign in again.
            </p>
          </div>
        )}
        {step === "landing-section" && (
          <div className="mimin:text-center mimin:space-y-3">
            {config?.theme?.chatWindow.header?.avatarSrc && (
              <img
                src={config.theme.chatWindow.header.avatarSrc}
                alt="logo"
                className="mimin:w-20 mimin:aspect-[4/3] mimin:object-cover mimin:bg-gray-100 mimin:text-gray-500 mimin:text-xs mimin:mx-auto mimin:rounded-lg mimin:overflow-hidden"
              />
            )}
            <h1 className="mimin:text-[#0096A2] mimin:text-xl mimin:font-bold">
              Explore the {config?.theme?.chatWindow.header?.title}
            </h1>
            <p className="mimin:text-gray-500">
              Sign in and start chatting with your smart AI assistant ready to
              help anytime, day or night!
            </p>
            <div className="mimin:flex mimin:flex-col mimin:gap-3 mimin:pt-4">
              <button
                className="mimin:text-white mimin:w-full mimin:px-4 mimin:py-2 mimin:rounded-md mimin:cursor-pointer mimin:hover:opacity-90 mimin:transition"
                onClick={() => setStep("sign-in")}
                style={{
                  backgroundColor: config?.theme?.chatWindow.greating?.color,
                  color: config?.theme?.chatWindow.greating?.title
                }}
              >
                Sign In
              </button>
              {config?.theme?.chatWindow.enableRegister && (
                <button
                  className="mimin:w-full mimin:px-4 mimin:py-2 mimin:border mimin:rounded-md mimin:cursor-pointer mimin:hover:opacity-90 mimin:transition"
                  onClick={() => setStep("create-account")}
                  style={{
                    borderColor: config?.theme?.chatWindow.greating?.color,
                    color: config?.theme?.chatWindow.greating?.color
                  }}
                >
                  Create Account
                </button>
              )}
            </div>
          </div>
        )}
        {step === "sign-in" && (
          <LoginSection
            onClickCreateAccount={() => setStep("create-account")}
            onSuccessLogin={onSuccessLogin}
          />
        )}
        {step === "create-account" && (
          <RegisterSection
            onClickSignin={() => setStep("sign-in")}
          />
        )}
      </div>
    </div>
  );
};

export default AuthWindow;
