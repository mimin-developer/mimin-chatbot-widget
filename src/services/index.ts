import axios, { type AxiosInstance } from "axios";
import { ENV } from "../config/environment";
import type { RealtimeSession, VoiceProvider } from "../types";

import { useConfigStore } from "../hooks/config-store";

type typeAPIURL = 'customer' | 'openai';
export function API(type: 'axios', typeAPI: typeAPIURL): AxiosInstance;
export function API(type: 'fetch', typeAPI: typeAPIURL): (url: string, options?: RequestInit) => Promise<Response>;

export function API(
  type: 'axios' | 'fetch',
  typeAPI: typeAPIURL
) {
  const config = useConfigStore.getState().config;
  const customerAPI = config?.credentials?.apiUrl || ENV.NEXT_PUBLIC_CUSTOMER_API;
  const openaiAPI = ENV.NEXT_PUBLIC_OPENAI_URL;

  const version = typeAPI === 'openai' ? 'v1' : 'api';

  const baseURL =
    typeAPI === 'customer'
      ? `${customerAPI}/${version}`
      : `${openaiAPI}/${version}`; // openai

  if (type === 'axios') {
    return axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  return async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    return fetch(`${baseURL}${url}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  };
}

interface RealtimeSessionData {
  provider?: string;
  model?: string;
  instructions?: string;
  tools?: RealtimeSession["tools"];
  client_secret?: { value: string };
  ephemeral_token?: string;
}

export const createRealtimeSession = async ({
  username,
  phone,
  chatbotAgentId,
}: {
  username?: string;
  phone: string;
  chatbotAgentId?: string;
}): Promise<RealtimeSession> => {
  const apiKey = useConfigStore.getState().config?.credentials?.apiKey || "";

  const response = await API("axios", "customer")(
    `/v1/call-session/create-realtime-session/${username}`,
    {
      method: "POST",
      headers: { "x-api-key": apiKey },
      data: {
        additional_data: { phone },
        ...(chatbotAgentId && { chatbot_agent: chatbotAgentId }),
      },
    }
  );

  const data: RealtimeSessionData = response.data || {};

  return {
    ...data,
    provider:
      data.provider?.toLowerCase() === "gemini"
        ? ("gemini" as VoiceProvider)
        : ("openai" as VoiceProvider),
  };
};

export const getClientInfo = async () => {
  try {
    const cacheKey = "mimin-cached-ip";
    let ip = localStorage.getItem(cacheKey);

    if (!ip) {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipRes.json();
      ip = ipData.ip;
      if (ip) {
        localStorage.setItem(cacheKey, ip);
      }
    }

    const userAgent = navigator.userAgent;

    return { ip, userAgent, isError: false };
  } catch (error) {
    return { isError: true, errorMessage: (error as Error).message };
  }
};