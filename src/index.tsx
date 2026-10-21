import ReactDOM from "react-dom/client";
import type { ChatbotConfig, Credentials } from "./types";
import { ChatWidget } from "./components/ChatWidget";
import "./index.css";
import { injectStyle } from "./utils/styleInjector";
import { ENV } from "./config/environment";
import {
  mapTemplateDataToTheme,
  mapAccountWidgetThemeToTheme,
  type AccountWidgetTheme,
  type CredentialTemplateData,
} from "./utils/credential-mapper";

// Export main Chatbot interface for React
export interface ChatbotInterface {
  init: (config?: ChatbotConfig) => void;
}

const Chatbot: ChatbotInterface = {
  init: async function (config: ChatbotConfig = {}) {
    try {
      // Inject required styles
      injectStyle();

      if (!config.credentials) {
        throw new Error("credentials are required");
      }

      const { credentials } = config;
      const apiKey = credentials.apiKey;
      const username = credentials.username;

      if (!apiKey) {
        throw new Error("apiKey is required");
      }

      if (!username) {
        throw new Error("username is required");
      }

      const widgetType = config.widgetType ?? "chatbot";
      const configErrors: string[] = [];

      if ((widgetType as string) === "website") {
        configErrors.push(
          `widgetType="website" is no longer supported — use "chatbot" or "voice-ai"`
        );
      }

      if (widgetType === "chatbot") {
        if (!credentials.chatbotAgentId) {
          configErrors.push(`credentials.chatbotAgentId is required when widgetType="chatbot"`);
        }
        if (!credentials.websiteId) {
          configErrors.push(`credentials.websiteId is required when widgetType="chatbot" (webhook recipient)`);
        }
      }

      // Hapus widget lama jika sudah ada
      const existing = document.getElementById("mimin-widget-container");
      if (existing) existing.remove();

      // Buat container baru
      const container = document.createElement("div");
      container.id = "mimin-widget-container";
      document.body.appendChild(container);

      const renderErrors = (errors: string[]) => {
        console.error(
          `[mimin-widget] Invalid configuration for widgetType "${widgetType}":`,
          errors
        );
        ReactDOM.createRoot(container).render(
          <ChatWidget config={config} signature="" configErrors={errors} />
        );
      };

      if (configErrors.length > 0) {
        renderErrors(configErrors);
        return;
      }

      // Remote config, mirroring chat-flow-3 chatbot-ui/[username]/page.tsx:
      //   - agent detail is fetched ONLY for an explicit credentials id
      //     (chatbotAgentId / voiceAgentId) — never for an auto-detected id
      //   - api-credential is fetched ONLY by the agent's data_id
      //     (= api_credential_id), never by credentials.websiteId
      //   - signature + account/get-widget provide the theme fallback
      const customerBase = `${(credentials.apiUrl || ENV.NEXT_PUBLIC_CUSTOMER_API).replace(/\/+$/, "")}/api`;

      const getJson = async (path: string, silent = false): Promise<any | null> => {
        try {
          const res = await fetch(`${customerBase}${path}`, {
            method: "GET",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
            },
          });
          if (!res.ok) {
            if (!silent) {
              console.error(`[mimin-widget] GET ${path} failed:`, res.status);
            }
            return null;
          }
          return await res.json();
        } catch (error) {
          console.error(`[mimin-widget] GET ${path} error:`, error);
          return null;
        }
      };

      // Dashboard logic (voice-ui explicitAgentVoice / chatbot-ui `if (!theme && hasAgent())`):
      // agent detail -> channel.find(data_type === "website").data_id[0] = api_credential_id
      // (fallback: agent data_id string or ._id)
      const getAgentDetail = async (agentId: string): Promise<any | null> => {
        const res = await getJson(
          `/v1/chatbot-agent/get/${encodeURIComponent(username)}/${encodeURIComponent(agentId)}`
        );
        return res?.data ?? res ?? null;
      };

      const explicitAgentId = credentials.chatbotAgentId || credentials.voiceAgentId;
      let agentData: any = null;
      if (explicitAgentId) {
        agentData = await getAgentDetail(explicitAgentId);
      }

      // Primary: agent.channel[] with data_type "website" -> data_id[0] = api_credential_id
      // (same as voice-ui explicitAgentVoice logic), fallback: data_id string / agent _id
      let dataId: string | undefined;

      const websiteChannel = Array.isArray(agentData?.channel)
        ? agentData.channel.find((c: any) => c?.data_type === "website")
        : undefined;
      const channelCredentialId = Array.isArray(websiteChannel?.data_id)
        ? websiteChannel.data_id[0]
        : websiteChannel?.data_id;

      if (channelCredentialId) {
        dataId = channelCredentialId;
      } else if (typeof agentData?.data_id === "string") {
        dataId = agentData.data_id;
      } else if (agentData?._id) {
        dataId = agentData._id;
      }

      let templateData: CredentialTemplateData | null = null;
      if (dataId) {
        const credData = await getJson(
          `/v1/api-credential/get/${encodeURIComponent(username)}/${encodeURIComponent(dataId)}`
        );
        templateData =
          credData?.data?.template_data ??
          credData?.data?.api_credential?.template_data ??
          null;
      }
      if (!templateData && agentData?.widget_setting) {
        templateData = agentData.widget_setting as CredentialTemplateData;
      }

      // signature + configurationTheme from account/get-widget
      const signatureRes = await fetch(
        `${customerBase}/v1/chatbotdata/create-signature/${encodeURIComponent(username)}`,
        {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      const { signature }: { signature: string } = await signatureRes.json();
      if (!signature) {
        renderErrors(["Failed to get signature from create-signature"]);
        return;
      }

      let configurationTheme: AccountWidgetTheme | null = null;
      if (credentials.chatbotAgentId) {
        const themeRes = await getJson(
          `/v1/account/get-widget/${encodeURIComponent(username)}?chatbot_agent=${encodeURIComponent(credentials.chatbotAgentId)}`,
          true
        );
        configurationTheme = themeRes?.data ?? null;
      }
      if (!configurationTheme) {
        const defaultThemeRes = await getJson(
          `/v1/account/get-widget/${encodeURIComponent(username)}`,
          true
        );
        configurationTheme = defaultThemeRes?.data ?? null;
      }

      // theme: credential template_data first, configurationTheme fallback
      let theme: ChatbotConfig["theme"];
      if (templateData) {
        configurationTheme = {
          ...(configurationTheme || {}),
          enable_voice: templateData.widget_enable_voice,
        };
        theme = mapTemplateDataToTheme(templateData);
      } else if (configurationTheme) {
        theme = mapAccountWidgetThemeToTheme(configurationTheme);
      } else {
        renderErrors([
          dataId
            ? `Widget configuration not found for api-credential "${dataId}" — create/select an api-credential in the dashboard`
            : "Failed to load widget configuration: send credentials.chatbotAgentId/voiceAgentId with a linked api-credential, or configure widget settings on the account",
        ]);
        return;
      }

      // voice agent + voiceName (gated by enable_voice, like chatbot-ui)
      const voiceAgentId =
        credentials.voiceAgentId ||
        templateData?.widget_voice_ai_agent_id ||
        undefined;

      if (widgetType === "voice-ai" && !voiceAgentId) {
        renderErrors([
          `No voice agent resolved for widgetType="voice-ai" (set credentials.voiceAgentId or configure widget_voice_ai_agent_id)`,
        ]);
        return;
      }

      let voiceName: string | undefined;
      if (voiceAgentId && configurationTheme.enable_voice === true) {
        const voiceAgentData =
          agentData && (agentData._id === voiceAgentId || agentData.id === voiceAgentId)
            ? agentData
            : await getAgentDetail(voiceAgentId);
        voiceName = voiceAgentData?.voice_ai_setting?.chatbot_voice_name;
      }

      const finalConfig: ChatbotConfig = {
        ...config,
        widgetType,
        credentials: {
          ...credentials,
          voiceAgentId,
        } satisfies Credentials,
        theme,
        data: {
          ...config.data,
          enable_voice: configurationTheme.enable_voice ?? false,
        },
      };

      // Render ChatWidget ke container
      ReactDOM.createRoot(container).render(
        <ChatWidget
          config={finalConfig}
          signature={signature}
          voiceName={voiceName}
        />
      );
    } catch (error) {
      console.error("Failed to initialize Mimin Chatbot React:", error);
    }
  },
};

// Expose to window
declare global {
  interface Window {
    Chatbot: ChatbotInterface;
  }
}

window.Chatbot = Chatbot;

export { Chatbot };
