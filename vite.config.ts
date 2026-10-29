import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// import tailwindcss from '@tailwindcss/vite'

import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env": "{}", // Untuk mencegah error process.env lain
    process: "{}", // Untuk mencegah error process
  },
  build: {
    lib: {
      entry: "src/index.tsx",
      name: "ChatWidget",
      formats: ["es"],
      // fileName: (format) => `chat-widget.${format}.js`,
      fileName: `chat-widget`,
    },
    rollupOptions: {
      // Bundle SEMUA dependencies ke dalam satu file
      external: [], // Tidak ada external dependencies sama sekali
      output: {
        // Memastikan semua exports tersedia
        exports: "named",
        // Memastikan format ES module bekerja dengan baik

        globals: {},
        // Bundle semua dependencies ke dalam satu file
        codeSplitting: false,
      },
    },
    // Menonaktifkan source maps agar kode sumber tidak terekspos
    sourcemap: false,

    // Memastikan semua dependencies di-bundle
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
});
