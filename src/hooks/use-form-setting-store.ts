import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FormSettingState {
  settings: Record<string, boolean>;
  setSettings: (settings: Record<string, boolean>) => void;
  setSetting: (key: string, value: boolean) => void;
  getSetting: (key: string) => boolean;
}

export const useFormSettingStore = create<FormSettingState>()(
  persist(
    (set, get) => ({
      settings: {
        "shortcut-ctrl-enter": false,
        "shortcut-enter": true,
      },
      setSettings: (settings) =>
        set((state) => ({
          settings: { ...state.settings, ...settings },
        })),
      setSetting: (key: string, value: boolean) =>
        set((state) => {
          const newSettings = { ...state.settings, [key]: value };
          if (
            value &&
            (key === "shortcut-ctrl-enter" || key === "shortcut-enter")
          ) {
            if (key === "shortcut-ctrl-enter") {
              newSettings["shortcut-enter"] = false;
            } else {
              newSettings["shortcut-ctrl-enter"] = false;
            }
          }
          return { settings: newSettings };
        }),
      getSetting: (key: string) => {
        return get().settings[key] || false;
      },
    }),
    {
      name: "mimin-form-settings-storage",
      partialize: (state: FormSettingState) => ({
        settings: state.settings,
      }),
    }
  )
);
