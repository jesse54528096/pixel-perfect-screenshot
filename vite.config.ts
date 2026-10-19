import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Plain client-side SPA: `vite build` emits static files to dist/.
export default defineConfig({
  plugins: [react(), tailwindcss(), tsConfigPaths()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  // Pre-bundle these together so sonner always shares the same React copy.
  optimizeDeps: { include: ["react", "react-dom", "sonner"] },
  build: { outDir: "dist" },
});
