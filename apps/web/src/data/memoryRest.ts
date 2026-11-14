import type { Rest, Scalar, SelectOptions } from "./rest";

type Row = Record<string, unknown>;

/** Banco em memoria que cumpre `Rest`. Serve a tela de demonstracao (sem conta, sem servidor) e aos testes:
 *  nada sai do navegador e tudo some ao recarregar a pagina. Nao imita o RLS. */
export class MemoryRest implements Rest {
  protected nextId = 1;

  constructor(public tables: Record<string, Row[]> = {}) {}

  /** Linhas de uma tabela (vazia se nao existir). */
  rows(table: string): Row[] {
    return this.tables[table] ?? [];
  }

  async select<T>(table: string, o: SelectOptions = {}): Promise<T[]> {
    let rows = [...(this.tables[table] ?? [])];
    for (const [k, v] of Object.entries(o.eq ?? {})) rows = rows.filter((r) => (r[k] ?? null) === v);
    for (const ord of [...(o.order ?? [])].reverse()) {
      const dir = ord.ascending === false ? -1 : 1;
      rows.sort((a, b) => dir * String(a[ord.column] ?? "").localeCompare(String(b[ord.column] ?? "")));
    }
    if (o.offset !== undefined || o.limit !== undefined) {
      const from = o.offset ?? 0;
      rows = rows.slice(from, from + (o.limit ?? rows.length));
    }
    if (o.columns && o.columns !== "*") {
      const cols = o.columns.split(",").map((c) => c.trim());
      rows = rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
    }
    return rows.map((r) => ({ ...r })) as T[];
  }

  async insert<T>(table: string, row: Row, options: { returning?: boolean } = {}): Promise<T | null> {
    const saved = { id: `id-${this.nextId++}`, ...row, revoked_at: row.revoked_at ?? null };
    (this.tables[table] ??= []).push(saved);
    return options.returning === false ? null : ({ ...saved } as T);
  }

  async update<T>(table: string, match: Record<string, Scalar>, patch: Row): Promise<T[]> {
    const hit = (this.tables[table] ?? []).filter((r) => Object.entries(match).every(([k, v]) => (r[k] ?? null) === v));
    for (const r of hit) Object.assign(r, patch);
    return hit.map((r) => ({ ...r })) as T[];
  }
}
