import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // le o .env da RAIZ do repositorio. Seguro: o Vite so expoe ao navegador as variaveis com prefixo VITE_
  // (a chave secreta e a senha do banco, sem prefixo, nunca entram no bundle; scripts/check_bundle conferem).
  envDir: "../..",
  test: {
    environment: "node", // a logica e o SVG renderizado em string nao precisam de DOM
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
