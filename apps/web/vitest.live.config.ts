import { defineConfig } from "vitest/config";

// Verificacao AO VIVO (usa o Supabase real): npm run test:live. Fica fora do `npm test` de proposito.
// Arquivos em sequencia: um grava consentimentos e o outro grava laudos; juntos, um mudaria as contagens do outro.
export default defineConfig({
  envDir: "../..",
  test: { environment: "node", include: ["src/live/**/*.live.ts"], testTimeout: 90_000, hookTimeout: 90_000, fileParallelism: false },
});
