import type { CSSProperties } from "react";
import type { ChatbotConfig } from "../types";

export const getMessageStyleVars = (
  isOwn: boolean,
  config: ChatbotConfig | null | undefined
): CSSProperties => {
  const userTextColor =
    config?.theme?.chatWindow?.userMessage?.textColor || "#ffffff";
  const botTextColor =
    config?.theme?.chatWindow?.botMessage?.textColor || "#0096a2";

  const linkColor = isOwn ? userTextColor : botTextColor;

  const isUserDark =
    userTextColor.toLowerCase() === "#ffffff" ||
    userTextColor.toLowerCase() === "#fff";
  const isBotDark =
    botTextColor.toLowerCase() === "#ffffff" ||
    botTextColor.toLowerCase() === "#fff";

  const dark = isOwn ? isUserDark : isBotDark;
  const codeColor = isOwn ? userTextColor : botTextColor;
  const codeBg = dark
    ? "rgba(255, 255, 255, 0.15)"
    : isOwn
    ? "rgba(0, 0, 0, 0.06)"
    : "rgba(0, 0, 0, 0.05)";
  const codeBorder = dark
    ? "rgba(255, 255, 255, 0.2)"
    : isOwn
    ? "rgba(0, 0, 0, 0.08)"
    : "rgba(0, 0, 0, 0.05)";

  const vars: Record<string, string> = {
    "--chatbot-ui-link-color": linkColor,
    "--chatbot-ui-code-bg": codeBg,
    "--chatbot-ui-code-color": codeColor,
    "--chatbot-ui-code-border": codeBorder,
  };

  return vars as CSSProperties;
};

const PLACEHOLDER_PATTERN = /\u0000(\d+)\u0000/g;

export const processMessage = (message: string): string => {
  const placeholders: string[] = [];

  const savePlaceholder = (val: string): string => {
    placeholders.push(val);
    return `\u0000${placeholders.length - 1}\u0000`;
  };

  // 0. Process and protect anchor HTML bawaan pesan
  const htmlProcessed = message
    .replace(/\u0000/g, "")
    .replace(
      /<a href="([^"]+)"[^>]*>(.*?)<\/a>/g,
      (_, href, label) =>
        savePlaceholder(
          `<a href="${href}" target="_blank" class="chatbot-ui-link" rel="noopener noreferrer">${label}</a>`
        )
    );

  // 1. Process and protect code blocks/spans
  let text = htmlProcessed.replace(
    /```([\s\S]*?)```|`([^`]+)`/g,
    (_, block, inline) => {
      const content = block || inline;
      const isBlock = !!block;
      const className = isBlock
        ? "chatbot-ui-code chatbot-ui-code-block"
        : "chatbot-ui-code";
      return savePlaceholder(`<code class="${className}">${content}</code>`);
    }
  );

  // 2. Process and protect markdown links
  text = text.replace(
    /\[(.*?)\]\((https?:\/\/[^\s\)]+)\)/g,
    (_, textVal, urlVal) => {
      return savePlaceholder(
        `<a href="${urlVal}" target="_blank" class="chatbot-ui-link" rel="noopener noreferrer">${textVal}</a>`
      );
    }
  );

  // 3. Process and protect raw URLs
  text = text.replace(/https?:\/\/[^\s"<>\u0000]+/g, (match) => {
    return savePlaceholder(
      `<a href="${match}" target="_blank" class="chatbot-ui-link" rel="noopener noreferrer">${match}</a>`
    );
  });

  // 4. Formatter bold & italic
  const boldProcessed = text.replace(/\*(.*?)\*/g, "<strong>$1</strong>");
  const italicProcessed = boldProcessed.replace(/\_(.*?)\_/g, "<em>$1</em>");

  // 5. Restore placeholders (berulang karena placeholder bisa bersarang)
  let result = italicProcessed;
  for (let pass = 0; pass <= placeholders.length; pass++) {
    const restored = result.replace(
      PLACEHOLDER_PATTERN,
      (_, key) => placeholders[Number(key)] ?? ""
    );
    if (restored === result) break;
    result = restored;
  }

  return result.replace(/\n/g, "<br>");
};
