import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: false }
    }
  },
  optimizeDeps: {
    include: [
      "@mantine/core",
      "@mantine/hooks",
      "@tabler/icons-react",
      "recharts",
      "react",
      "react-dom",
      "react-router-dom"
    ]
  }
});
