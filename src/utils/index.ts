import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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