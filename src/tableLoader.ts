// Shared cached loaders for liu-table.json and opencc-chars.json across lazy modes.

import type { Table } from "./articleText";
import type { Variants } from "./lookupLogic";

let tablePromise: Promise<Table> | null = null;

export function loadTable(): Promise<Table> {
  if (!tablePromise) {
    tablePromise = fetch("./liu-table.json")
      .then((r) => {
        if (!r.ok) throw new Error("table " + r.status);
        return r.json() as Promise<Table>;
      })
      .catch((e) => {
        tablePromise = null;
        throw e;
      });
  }
  return tablePromise;
}

let variantsPromise: Promise<Variants | null> | null = null;

export function loadVariants(): Promise<Variants | null> {
  if (!variantsPromise) {
    variantsPromise = fetch("./opencc-chars.json")
      .then((r) => {
        if (!r.ok) throw new Error("variants " + r.status);
        return r.json() as Promise<Variants>;
      })
      .catch(() => {
        variantsPromise = null;
        return null;
      });
  }
  return variantsPromise;
}
