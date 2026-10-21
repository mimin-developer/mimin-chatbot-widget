import { useEffect, useMemo, useRef, useState } from "react";
import { Settings2, X } from "lucide-react";
import { cn } from "../../../utils";
import { useConfigStore } from "../../../hooks/config-store";
import { useFormSettingStore } from "../../../hooks/use-form-setting-store";

const FORM_SETTINGS: {
  id: string;
  label: string;
  description: string;
}[] = [
  {
    id: "shortcut-enter",
    label: "Enter to send",
    description: "Press Enter to send message (Shift+Enter for new line)",
  },
  {
    id: "shortcut-ctrl-enter",
    label: "Ctrl + Enter to send",
    description: "Press Ctrl+Enter to send message (Enter for new line)",
  },
];

const FormSettingModal = ({ disabled }: { disabled: boolean }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { getSetting, setSetting } = useFormSettingStore();
  const { config } = useConfigStore();

  const formSettings = useMemo(() => FORM_SETTINGS, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="mimin:relative" ref={containerRef}>
      <button
        type="button"
        title="Form Settings"
        className={cn(
          "mimin:w-7 mimin:h-7 mimin:rounded-full mimin:transition-colors mimin:flex mimin:items-center mimin:justify-center mimin:cursor-pointer",
          disabled && "mimin:opacity-50"
        )}
        style={{
          backgroundColor:
            (config?.theme?.chatWindow?.textInput?.footerTextColor ||
              "#0096a2") + "40",
        }}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <Settings2
          className="mimin:w-3.5 mimin:h-3.5"
          color={
            (config?.theme?.chatWindow?.textInput?.footerTextColor ||
              "#ffffff") as string
          }
        />
      </button>

      {open && (
        <div className="mimin:absolute mimin:bottom-9 mimin:left-0 mimin:mb-2 mimin:min-w-[18rem] mimin:max-w-xs mimin:bg-white mimin:border mimin:border-gray-200 mimin:rounded-lg mimin:shadow-lg mimin:p-3 mimin:z-50">
          <div className="mimin:flex mimin:items-center mimin:justify-between mimin:mb-3">
            <h3 className="mimin:text-sm mimin:font-medium mimin:text-gray-700">
              Form Settings
            </h3>
            <button
              type="button"
              className="mimin:h-6 mimin:w-6 mimin:p-0 mimin:rounded mimin:flex mimin:items-center mimin:justify-center mimin:hover:bg-gray-100 mimin:text-gray-500 mimin:cursor-pointer"
              onClick={() => setOpen(false)}
            >
              <X className="mimin:h-3.5 mimin:w-3.5" />
            </button>
          </div>
          <ul className="mimin:grid mimin:grid-cols-1 mimin:gap-2">
            {formSettings.map((setting) => (
              <li
                className="mimin:grid mimin:grid-cols-4 mimin:gap-2 mimin:pb-0.5"
                key={setting.id}
              >
                <div className="mimin:flex mimin:flex-col mimin:gap-px mimin:col-span-3 mimin:justify-center">
                  <p className="mimin:font-medium mimin:text-xs mimin:text-gray-700">
                    {setting.label}
                  </p>
                  <p className="mimin:text-[10px] mimin:text-gray-500">
                    {setting.description}
                  </p>
                </div>
                <div className="mimin:flex mimin:flex-col mimin:justify-center mimin:items-end">
                  <input
                    id={`mimin-${setting.id}`}
                    type="checkbox"
                    className="mimin:h-4 mimin:w-4 mimin:cursor-pointer"
                    style={{
                      accentColor:
                        config?.theme?.chatWindow?.textInput?.sendButtonColor ||
                        "#0096a2",
                    }}
                    checked={getSetting(setting.id)}
                    onChange={(e) => setSetting(setting.id, e.target.checked)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FormSettingModal;
