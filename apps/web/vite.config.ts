import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
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
