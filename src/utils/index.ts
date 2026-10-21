import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RealtimeTool } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const setDeep = (
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void => {
  const keys = path.split(".");
  let current: Record<string | number, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const nextKey = keys[i + 1];
    if (typeof current[key] !== "object" || current[key] === null) {
      current[key] = /^\d+$/.test(nextKey) ? [] : {};
    }
    current = current[key] as Record<string | number, unknown>;
  }

  const lastKey = keys[keys.length - 1];
  if (/^\d+$/.test(lastKey) && Array.isArray(current)) {
    current[Number(lastKey)] = value;
  } else {
    current[lastKey] = value;
  }
};

export const formatAudioCurrentTime = (seconds: number): string => {
  if (!isFinite(seconds) || isNaN(seconds)) return '00:00:00';
  if (seconds < 0) seconds = 0;

  // Hitung jam, menit, dan detik
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  // Gunakan padStart untuk menambahkan nol di depan jika kurang dari 10
  return [hours, minutes, Math.floor(secs)]
    .map((unit) => String(unit).padStart(2, '0'))
    .join(':');
};

export const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  const message = (data as { message?: unknown })?.message;
  if (typeof message === "string" && message.trim()) return message;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const convertToBase64 = (
  input: File | Blob,
  fileName?: string
) => {
  return new Promise<{
    type: "image" | "video" | "audio" | "document";
    name: string;
    data: string;
  }>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const mime = input.type || "";
      const type = mime.startsWith("image/")
        ? "image"
        : mime.startsWith("video/")
          ? "video"
          : mime.startsWith("audio/")
            ? "audio"
            : "document";

      resolve({
        type,
        name:
          input instanceof File
            ? input.name
            : fileName || "file",
        data: reader.result as string,
      });
    };

    reader.onerror = reject;

    reader.readAsDataURL(input);
  });
};

interface ToolApiConfig {
  method?: string;
  base_url?: string;
  endpoint?: string;
  headers?: Record<string, string>;
  param_mapping?: Record<
    string,
    { location: string; key: string }
  >;
  fixed_params?: Record<string, unknown>;
}

interface ToolAuthentication {
  type?: string;
  token?: string;
  header_name?: string;
}

export const executeToolCall = async (
  tools: RealtimeTool[],
  toolName: string,
  toolArgs: Record<string, unknown>
): Promise<unknown> => {
  try {
    const toolConfig = tools.find((t) => t.name === toolName);
    if (!toolConfig) return { error: "Tool configuration not found", tool_name: toolName };

    if (typeof toolConfig.handler === "function") {
      return await (toolConfig.handler as (args: Record<string, unknown>) => Promise<unknown>)(toolArgs);
    }

    if (!toolConfig.api_config) return { error: "Tool configuration not found", tool_name: toolName };

    const { api_config, authentication } = toolConfig as unknown as {
      api_config: ToolApiConfig;
      authentication?: ToolAuthentication;
    };
    const method = (api_config.method || "GET").toUpperCase();
    const bodyData: Record<string, unknown> = {};
    const queryParams: Record<string, unknown> = {};
    const pathParams: Record<string, string> = {};
    if (api_config.fixed_params && method === "POST") {
      Object.assign(bodyData, api_config.fixed_params);
    }

    if (api_config.param_mapping) {
      Object.entries(api_config.param_mapping).forEach(([paramKey, mapping]) => {
        const value = toolArgs[paramKey];
        if (value === undefined) return;
        switch (mapping.location) {
          case "body":
            setDeep(bodyData, mapping.key, value);
            break;
          case "query":
            setDeep(queryParams, mapping.key, value);
            break;
          case "path":
            pathParams[mapping.key] = String(value);
            break;
        }
      });
    }

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...api_config.headers,
    };
    if (authentication?.token) {
      switch (authentication.type) {
        case "bearer":
          requestHeaders["Authorization"] = authentication.token.startsWith("Bearer ")
            ? authentication.token
            : `Bearer ${authentication.token}`;
          break;
        case "api_key":
          if (authentication.header_name) {
            requestHeaders[authentication.header_name] = authentication.token;
          }
          break;
        case "basic":
          requestHeaders["Authorization"] = authentication.token.startsWith("Basic ")
            ? authentication.token
            : `Basic ${authentication.token}`;
          break;
      }
    }

    let finalEndpoint = api_config.endpoint || "";
    Object.entries(pathParams).forEach(([key, value]) => {
      // Sanitize path parameter to prevent path traversal (e.g. '../')
      const sanitizedValue = String(value).replace(/\.\.\//g, "");
      finalEndpoint = finalEndpoint.replace(`{${key}}`, sanitizedValue).replace(`:${key}`, sanitizedValue);
    });

    const queryString =
      Object.keys(queryParams).length > 0
        ? "?" + new URLSearchParams(queryParams as Record<string, string>).toString()
        : "";

    const fullUrl = `${api_config.base_url || ""}${finalEndpoint}${queryString}`;

    const response = await fetch(fullUrl, {
      method,
      headers: requestHeaders,
      body: method !== "GET" && Object.keys(bodyData).length > 0 ? JSON.stringify(bodyData) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Tool request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    return { error: "Tool execution failed", details: String(error) };
  }
};