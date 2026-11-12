import { defineConfig } from "vitest/config";

// Verificacao AO VIVO (usa o Supabase real): npm run test:live. Fica fora do `npm test` de proposito.
export default defineConfig({
  envDir: "../..",
  test: { environment: "node", include: ["src/live/**/*.live.ts"], testTimeout: 60_000, hookTimeout: 60_000 },
});
