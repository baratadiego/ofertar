import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Gera um único index.html autocontido: funciona no GitHub Pages e também
// aberto direto do computador (duplo clique), sem servidor.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: "dist", chunkSizeWarningLimit: 4000 },
});
