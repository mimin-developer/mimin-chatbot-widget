import type { ThemeConfig } from "../types";

export interface CredentialTemplateData {
  website_id?: string;
  widget_enable_voice?: boolean;
  widget_enable_voice_ai?: boolean;
  widget_voice_ai_agent_id?: string;
  widget_icon?: string;
  widget_title?: string;
  widget_title_color?: string;
  widget_color?: string;
  widget_avatar_chatbot?: string;
  widget_chatbot_name?: string;
  widget_chatbot_description?: string;
  widget_enable_greeting?: boolean;
  widget_greeting_title?: string;
  widget_greeting_description?: string;
  widget_greeting_avatar?: string;
  widget_enable_login?: boolean;
  widget_enable_register?: boolean;
  widget_login_by_phone?: boolean;
  widget_login_by_password?: boolean;
  widget_register_by_phone?: boolean;
  widget_register_by_password?: boolean;
  widget_chatbot_text_color?: string;
  widget_chatbot_bubble_color?: string;
  widget_human_text_color?: string;
  widget_human_bubble_color?: string;
  widget_footer_text?: string;
  widget_footer_text_color?: string;
  widget_header_icon_color?: string;
  widget_button_voice_ai_color?: string;
  widget_button_refresh_color?: string;
  widget_button_close_color?: string;
  chat_bg_color?: string;
  [key: string]: unknown;
}

// Canonical mapping mirrored from chat-flow-3 chatbot-ui/[username]/page.tsx
// (template_data -> ThemeConfig) and the dashboard embed snippet generator.
export function mapTemplateDataToTheme(t: CredentialTemplateData): ThemeConfig {
  return {
    button: {
      backgroundColor: t.widget_color,
      textColor: t.widget_title_color,
      iconSrc: t.widget_icon,
      tooltip: t.widget_title,
    },
    chatWindow: {
      isActiveCall: t.widget_enable_voice_ai ?? false,
      enableLogin: t.widget_enable_login ?? false,
      enableRegister: t.widget_enable_register ?? false,
      enableGreating: t.widget_enable_greeting ?? false,
      enableMediaUpload: true,
      loginByPhone: t.widget_login_by_phone ?? false,
      loginByPassword: t.widget_login_by_password ?? false,
      registerByPhone: t.widget_register_by_phone ?? false,
      registerByPassword: t.widget_register_by_password ?? false,
      header: {
        backgroundColor: t.widget_color,
        color: t.widget_header_icon_color,
        title: t.widget_chatbot_name,
        description: t.widget_chatbot_description,
        avatarSrc: t.widget_avatar_chatbot,
        closeColorButton: t.widget_button_close_color,
        voiceAIColorButton: t.widget_button_voice_ai_color,
        refreshColorButton: t.widget_button_refresh_color,
      },
      body: {
        backgroundColor: t.chat_bg_color,
      },
      botMessage: {
        backgroundColor: t.widget_chatbot_bubble_color,
        borderColor: t.widget_chatbot_text_color,
        textColor: t.widget_chatbot_text_color,
        iconUrl: t.widget_icon,
      },
      userMessage: {
        backgroundColor: t.widget_human_bubble_color,
        borderColor: t.widget_human_text_color,
        textColor: t.widget_human_text_color,
      },
      greating: {
        title: t.widget_greeting_title,
        description: t.widget_greeting_description,
        avatar: t.widget_greeting_avatar,
        color: t.widget_color,
      },
      textInput: {
        placeholder: "Enter your message here...",
        backgroundColor: t.widget_color,
        borderColor: t.widget_title_color,
        sendButtonColor: t.widget_color,
        footerText: t.widget_footer_text,
        footerTextColor: t.widget_footer_text_color,
      },
    },
  };
}

// Fallback mapping mirrored from chat-flow-3 chatbot-ui/[username]/page.tsx
// final `if (!theme)` branch: data from /v1/account/get-widget uses field
// names WITHOUT the widget_ prefix for some keys.
export interface AccountWidgetTheme {
  widget_enable_login?: boolean;
  widget_enable_register?: boolean;
  widget_enable_greeting?: boolean;
  widget_color?: string;
  widget_chatbot_name?: string;
  widget_avatar_chatbot?: string;
  widget_greeting_title?: string;
  widget_greeting_description?: string;
  widget_greeting_avatar?: string;
  widget_title_color?: string;
  widget_icon?: string;
  header_icon_color?: string;
  chatbot_description?: string;
  button_refresh_color?: string;
  button_voice_ai_color?: string;
  chatbot_bubble_color?: string;
  chatbot_text_color?: string;
  human_bubble_color?: string;
  human_text_color?: string;
  footer_text?: string;
  footer_text_color?: string;
  enable_voice?: boolean;
  [key: string]: unknown;
}

export function mapAccountWidgetThemeToTheme(c: AccountWidgetTheme): ThemeConfig {
  return {
    button: {
      backgroundColor: c.widget_color,
      textColor: c.widget_title_color,
      iconSrc: c.widget_icon,
      tooltip: c.widget_chatbot_name,
    },
    chatWindow: {
      isActiveCall: true,
      enableLogin: c.widget_enable_login ?? false,
      enableRegister: c.widget_enable_register ?? false,
      enableGreating: c.widget_enable_greeting ?? false,
      enableMediaUpload: true,
      header: {
        backgroundColor: c.widget_color,
        color: c.header_icon_color,
        title: c.widget_chatbot_name,
        description: c.chatbot_description,
        avatarSrc: c.widget_avatar_chatbot,
        refreshColorButton: c.button_refresh_color,
        voiceAIColorButton: c.button_voice_ai_color,
      },
      body: {},
      botMessage: {
        backgroundColor: c.chatbot_bubble_color,
        borderColor: c.chatbot_text_color,
        textColor: c.chatbot_text_color,
        iconUrl: c.widget_icon,
      },
      userMessage: {
        backgroundColor: c.human_bubble_color,
        borderColor: c.human_text_color,
        textColor: c.human_text_color,
      },
      greating: {
        title: c.widget_greeting_title,
        description: c.widget_greeting_description,
        avatar: c.widget_greeting_avatar,
        color: c.widget_color,
      },
      textInput: {
        backgroundColor: c.widget_color,
        borderColor: c.widget_title_color,
        footerText: c.footer_text,
        footerTextColor: c.footer_text_color,
        sendButtonColor: c.widget_color,
      },
    },
  };
}
