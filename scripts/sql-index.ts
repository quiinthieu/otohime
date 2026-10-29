import { writeFileSync } from "node:fs";
import { publicSqlData } from "../lib/sql-data.ts";
writeFileSync(new URL("../public/ledger-sql.json", import.meta.url), JSON.stringify(publicSqlData()) + "\n");
console.log("SQL desk: public JSON exported");
