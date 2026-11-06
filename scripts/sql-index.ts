import { writeFileSync, readFileSync } from "node:fs";
import { publicSqlData } from "../lib/sql-data.ts";
const target = new URL("../public/ledger-sql.json", import.meta.url);
const fresh = JSON.stringify(publicSqlData()) + "\n";
let current: string | null = null;
try {
  current = readFileSync(target, "utf-8");
} catch {}
if (fresh !== current) {
  writeFileSync(target, fresh);
}
console.log("SQL desk: public JSON exported");
