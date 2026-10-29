export interface ChatWindowConfig {
  isActiveCall?: boolean;
  enableLogin?: boolean;
  enableRegister?: boolean;
  loginByPhone?: boolean;
  loginByPassword?: boolean;
  registerByPhone?: boolean;
  registerByPassword?: boolean;
  enableGreating?: boolean;
  enableMediaUpload?: boolean;
  width?: string;
  height?: string;
  header?: {
    backgroundColor?: string;
    color?: string;
    title?: string;
    description?: string;
    avatarSrc?: string;
    closeColorButton?: string;
    voiceAIColorButton?: string;
    refreshColorButton?: string;
  };
  body?: {
    backgroundColor?: string;
  };
  icon?: {
    phoneColor?: string;
    refreshColor?: string;
    closeColor?: string;
  };
  userMessage?: {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    iconUrl?: string;
  };
  botMessage?: {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    iconUrl?: string;
  };
  textInput?: {
    backgroundColor?: string;
    borderColor?: string;
    placeholder?: string;
    sendButtonColor?: string;
    footerText?: string;
    footerTextColor?: string;
  };
  greating?: {
    title?: string;
    description?: string;
    avatar?: string;
    color?: string;
  };
}

export interface ButtonConfig {
  backgroundColor?: string;
  textColor?: string;
  iconSrc?: string;
  tooltip?: string;
}

export interface ThemeConfig {
  button: ButtonConfig;
  chatWindow: ChatWindowConfig;
}

export interface Credentials {
  apiKey?: string;
  username?: string;
  websiteId?: string;
  chatbotAgentId?: string;
  voiceAgentId?: string;
  apiUrl?: string;
}

export interface ChatbotConfig {
  widgetType?: "chatbot" | "voice-ai";
  credentials?: Credentials;
  theme?: ThemeConfig;
  data?: {
    enable_voice?: boolean;
    [key: string]: unknown;
  };
}

export interface PaginationData {
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

export interface AuthCookie {
  phone: string;
}

export interface Environment {
  NEXT_PUBLIC_CUSTOMER_API: string;
  NEXT_PUBLIC_OPENAI_URL: string;
  NEXT_PUBLIC_API_SOCKET: string;
  NEXT_PUBLIC_API_SOCKET_PATHNAME: string;
}

export interface IEventStreamResponse {
  event: "start" | "token" | "end";
  data: string;
}

export interface IESPayloadResponse {
  event: "payload";
  chat_history_id: string;
  media: string;
  media_type: string;
  message: string;
  title: string;
  type: string;
}

export interface IESMetaDataResponse {
  event: "metadata";
  data: {
    chatId: string;
    chatMessageId: string;
    memoryType: string;
    question: string;
    sessionId: string;
  };
}

export type IESResponse =
  | IEventStreamResponse
  | IESPayloadResponse
  | IESMetaDataResponse;

export interface MediaItem {
  type: string;
  name: string;
  data: string;
}

export interface Interaction {
  human?: Message;
  ai?: Message;
  date: string | Date;
  id: string;
}

export interface Message {
  content: string;
  additional_kwargs: Record<string, unknown>;
  example: boolean;
  media?: MediaItem[];
  isError?: boolean;
  status?: "pending" | "sending" | "sent" | "failed";
  _tempId?: string;
  isUploading?: boolean;
  context_id?: string;
  context?: {
    id: string;
    direction: "incoming" | "outgoing";
    text: string;
    file: string;
    file_name: string;
  };
}

export interface Pagination {
  total: 2;
  total_pages: 1;
  page: 1;
  size: 100;
}

export type LoginTypeAction =
  | "default-password"
  | "forgot-password"
  | "activate-user";

export type Conversation = {
  _id: string;
  phone: string;
  type: string;
  session_active: boolean;
  chatbot_active: boolean;
  thread_id: string;
  timer_start_at: string;
  total_timer: number;
  created_at: string;
  updated_at: string;
  title?: string;
};

export type ConversationsResponse = {
  data: Conversation[];
  size: number;
  pages: number;
  page: number;
  limit: number;
};

export type Agent = {
  id?: string;
  _id?: string;
  name: string;
  type?: string;
  is_active?: boolean;
  template_data: { voice_ai_agent_id: string }
}

export type VoiceProvider = "openai" | "gemini";

export interface RealtimeTool {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RealtimeSession {
  provider: VoiceProvider;
  model?: string;
  instructions?: string;
  tools?: RealtimeTool[];
  client_secret?: { value: string };
  ephemeral_token?: string;
}
