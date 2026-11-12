import type { SupabaseClient } from "@supabase/supabase-js";

export type Scalar = string | number | boolean | null;

export interface SelectOptions {
  columns?: string;
  eq?: Record<string, Scalar>;
  order?: { column: string; ascending?: boolean }[];
  limit?: number;
  offset?: number;
}

/** O pouco que a logica de dados precisa do banco. Quem decide o que cada pessoa ve e o RLS (no servidor);
 *  a aplicacao nunca filtra por "papel": so pede, e recebe o que a politica permite. */
export interface Rest {
  select<T>(table: string, options?: SelectOptions): Promise<T[]>;
  /** `returning: false` nao le a linha de volta: necessario quando quem grava nao tem permissao de leitura (ex.: o
   *  medico grava no access_log mas so o paciente le). Pedir a linha de volta falharia no RLS. */
  insert<T>(table: string, row: Record<string, unknown>, options?: { returning?: boolean }): Promise<T | null>;
  update<T>(table: string, match: Record<string, Scalar>, patch: Record<string, unknown>): Promise<T[]>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** O Supabase devolve no maximo 1000 linhas por pedido: pagina ate acabar. Exige uma ordenacao estavel. */
export async function selectAll<T>(rest: Rest, table: string, options: SelectOptions = {}, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await rest.select<T>(table, { ...options, limit: pageSize, offset });
    out.push(...page);
    if (page.length < pageSize) return out;
  }
}

/** Adaptador do supabase-js. Fica isolado aqui: o resto do app so conhece `Rest`. */
export function supabaseRest(client: SupabaseClient): Rest {
  const fail = (e: { message: string; code?: string }): never => {
    throw new ApiError(e.message, e.code);
  };
  return {
    async select(table, o = {}) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- os tipos genericos do builder nao ajudam aqui
      let q: any = client.from(table).select(o.columns ?? "*");
      for (const [k, v] of Object.entries(o.eq ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v);
      for (const ord of o.order ?? []) q = q.order(ord.column, { ascending: ord.ascending ?? true });
      if (o.limit !== undefined || o.offset !== undefined) {
        const from = o.offset ?? 0;
        q = q.range(from, from + (o.limit ?? 1000) - 1);
      }
      const { data, error } = await q;
      if (error) fail(error);
      return (data ?? []) as never;
    },
    async insert(table, row, opts = {}) {
      if (opts.returning === false) {
        const { error } = await client.from(table).insert(row);
        if (error) fail(error);
        return null;
      }
      const { data, error } = await client.from(table).insert(row).select().single();
      if (error) fail(error);
      return data as never;
    },
    async update(table, match, patch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = client.from(table).update(patch);
      for (const [k, v] of Object.entries(match)) q = v === null ? q.is(k, null) : q.eq(k, v);
      const { data, error } = await q.select();
      if (error) fail(error);
      return (data ?? []) as never;
    },
  };
}
