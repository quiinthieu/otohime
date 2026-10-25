import Anthropic from "@anthropic-ai/sdk";
import { lt, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db/client";
import { askUsage } from "@/db/schema";
import type { AskIndex } from "@/lib/ask";
import { CLIENT_OPTIONS, handleGet, handlePost, type AskDeps, type AskUsageStore } from "@/lib/ask-llm";
import askIndex from "@/public/ask-index.json";

// Ask the console's model tier; lib/ask-llm.ts holds the rules. 404 unless ASK_LLM=1 and ANTHROPIC_API_KEY.
// Node runtime: the default, and with cacheComponents a `runtime` export is a build error.

const store: AskUsageStore = {
  async hit(bucket) {
    const [row] = await db
      .insert(askUsage)
      .values({ bucket, count: 1 })
      .onConflictDoUpdate({ target: askUsage.bucket, set: { count: sql`${askUsage.count} + 1`, updatedAt: sql`now()` } })
      .returning({ count: askUsage.count });
    // The day's first request sweeps buckets nobody can hit again.
    if (row.count === 1 && bucket.startsWith("day:")) {
      await db.delete(askUsage).where(lt(askUsage.updatedAt, sql`now() - interval '2 days'`));
    }
    return row.count;
  },
};

let client: Anthropic | undefined;

function deps(): AskDeps {
  return {
    env: {
      ASK_LLM: process.env.ASK_LLM,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    },
    index: askIndex as unknown as AskIndex,
    store,
    complete: (params) => (client ??= new Anthropic(CLIENT_OPTIONS)).beta.messages.create(params),
  };
}

export async function GET() {
  // Read the env per request, never at build.
  await connection();
  return handleGet(deps());
}

export async function POST(request: Request) {
  return handlePost(request, deps());
}
