import demo from "../demo/marta.json";
import type { HealthData } from "../types";

/** De onde vem os dados. Hoje so o modo demonstracao (paciente SINTETICA).
 *  O proximo adaptador le as views `observation_series` e `timeline_events` do Supabase com o
 *  token do usuario: as colunas ja sao as mesmas, e o RLS decide o que cada pessoa enxerga. */
export interface DataSource {
  load(): Promise<HealthData>;
}

export const demoSource: DataSource = {
  load: async () => demo as HealthData,
};
