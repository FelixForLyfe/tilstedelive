import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouterGenerator } from "@tanstack/router-plugin/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig(() => ({
  plugins: [
    tanstackRouterGenerator({
      target: "react",
    }),
    tanstackStart(),
    react(),
    tsconfigPaths(),
    tailwindcss(),
  ],
}));
