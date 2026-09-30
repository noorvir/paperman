import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: { "/rpc": "http://127.0.0.1:3000" },
  },
});
