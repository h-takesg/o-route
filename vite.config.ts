import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import ssr from "vike/plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ssr()
  ],
  server: {
    watch: {
      usePolling: true
    }
  },
  ssr: {
    noExternal: ["react-icons"],
    external: ["konva", "react-konva"],
  },
});
