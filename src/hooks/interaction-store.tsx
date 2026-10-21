import { create } from "zustand";
import type { Interaction, Message } from "../types";
import { persist } from "zustand/middleware";

interface SessionData {
  interactions: Interaction[];
  chatType: string | null;
}

interface InteractionsStoreState {
  interactions: Interaction[];
  chatType: string | null;
  histories?: Record<string, SessionData>;
  activeKey?: string | null;
  setInteractions: (interactions: Interaction[]) => void;
  addInteraction: (interaction: Interaction) => void;
  clearInteractions: () => void;
  updateAiInteractionByIndex: (idx: number, message: Message) => void;
  setChatType: (chatType: string | null) => void;
  loadSession: (username?: string, websiteId?: string) => void;
}

export const useInteractionsStore = create<InteractionsStoreState>()(
  persist(
    (set, _get) => ({
      interactions: [],
      chatType: null,
      histories: {},
      activeKey: null,

      loadSession: (username, websiteId) => {
        const key = `chat_${username || "default"}_${websiteId || "default"}`;

        set((state) => {
          const histories = state.histories || {};
          let session = histories[key];

          // Backward compatibility migration
          if (!session) {
            const isLegacyStore = state.activeKey === undefined || state.activeKey === null;
            const hasLegacyData = isLegacyStore && state.interactions && state.interactions.length > 0;
            
            session = {
              interactions: hasLegacyData ? state.interactions : [],
              chatType: hasLegacyData ? state.chatType : null,
            };
            histories[key] = session;
          }

          return {
            activeKey: key,
            histories,
            interactions: session.interactions,
            chatType: session.chatType,
          };
        });
      },

      setInteractions: (interactions) =>
        set((state) => {
          const activeKey = state.activeKey || "default";
          const histories = { ...state.histories };
          histories[activeKey] = {
            ...histories[activeKey],
            interactions,
            chatType: histories[activeKey]?.chatType ?? null,
          };
          return {
            interactions,
            histories,
          };
        }),

      addInteraction: (interaction) =>
        set((state) => {
          const activeKey = state.activeKey || "default";
          const newInteractions = [interaction, ...state.interactions];
          const histories = { ...state.histories };
          histories[activeKey] = {
            ...histories[activeKey],
            interactions: newInteractions,
            chatType: histories[activeKey]?.chatType ?? null,
          };
          return {
            interactions: newInteractions,
            histories,
          };
        }),

      updateAiInteractionByIndex: (idx, message) => {
        set((state) => {
          const activeKey = state.activeKey || "default";
          const newInteractions = state.interactions.map((i, index) =>
            index === idx ? { ...i, ai: { ...i.ai, ...message } } : i
          );
          const histories = { ...state.histories };
          histories[activeKey] = {
            ...histories[activeKey],
            interactions: newInteractions,
            chatType: histories[activeKey]?.chatType ?? null,
          };
          return {
            interactions: newInteractions,
            histories,
          };
        });
      },

      setChatType: (chatType) =>
        set((state) => {
          const activeKey = state.activeKey || "default";
          const histories = { ...state.histories };
          histories[activeKey] = {
            ...histories[activeKey],
            interactions: histories[activeKey]?.interactions ?? [],
            chatType,
          };
          return {
            chatType,
            histories,
          };
        }),

      clearInteractions: () =>
        set((state) => {
          const activeKey = state.activeKey || "default";
          const histories = { ...state.histories };
          histories[activeKey] = {
            ...histories[activeKey],
            interactions: [],
            chatType: histories[activeKey]?.chatType ?? null,
          };
          return {
            interactions: [],
            histories,
          };
        }),
    }),
    {
      name: "interactions-store",
    }
  )
);
