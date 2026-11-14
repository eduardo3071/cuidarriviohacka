import { MemoryRest } from "../data/memoryRest";
import type { Scalar, SelectOptions } from "../data/rest";

type Row = Record<string, unknown>;

/** Banco em memoria para testar a LOGICA (filtros, paginacao, projecao de colunas), registrando as chamadas.
 *  Nao imita o RLS: o que o servidor deixa cada pessoa ver e verificado ao vivo, nao aqui. */
export class FakeRest extends MemoryRest {
  calls: { op: "select" | "insert" | "update"; table: string; detail?: unknown }[] = [];

  override async select<T>(table: string, o: SelectOptions = {}): Promise<T[]> {
    this.calls.push({ op: "select", table, detail: o });
    return super.select<T>(table, o);
  }

  override async insert<T>(table: string, row: Row, options: { returning?: boolean } = {}): Promise<T | null> {
    this.calls.push({ op: "insert", table, detail: { row, options } });
    return super.insert<T>(table, row, options);
  }

  override async update<T>(table: string, match: Record<string, Scalar>, patch: Row): Promise<T[]> {
    this.calls.push({ op: "update", table, detail: { match, patch } });
    return super.update<T>(table, match, patch);
  }
}
