import { connection } from "next/server";
import { createKintsugiStore, kintsugiPool } from "@/lib/kintsugi-store";
import { kintsugiGet, kintsugiPost } from "@/lib/kintsugi-http";
function store() { try { return createKintsugiStore(kintsugiPool()); } catch { return undefined; } }
export async function GET() { await connection(); return kintsugiGet(store()); }
export async function POST(request: Request) { return kintsugiPost(request, store(), process.env.BETTER_AUTH_SECRET); }
