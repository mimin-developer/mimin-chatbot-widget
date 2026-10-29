const PRODUCTION_CSS_URL =
  "https://unpkg.com/mimin-chatbot-widget-react@latest/dist/chat-widget.css";
const DEVELOPMENT_CSS_URL = "/dist/chat-widget.css";

const MIMIN_WIDGET_ENV: "development" | "production" = "production"

export function injectStyle(): void {
  if (!document.getElementById("mimin-chatbot-widget-css")) {
    const env = MIMIN_WIDGET_ENV === "development"
      ? DEVELOPMENT_CSS_URL
      : PRODUCTION_CSS_URL;

    const tw = document.createElement("link");
    tw.rel = "stylesheet";
    tw.href = env;
    tw.id = "mimin-chatbot-widget-css";
    document.head.appendChild(tw);
  }
}
