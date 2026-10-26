import "server-only";
import seeds from "../content/bottles.json";
import { db } from "../db/client";
import { getSession } from "./dal";
import { createBottleService } from "./bottles-service";
import { createPostgresBottleStore } from "./bottles-store";
import type { Bottle } from "./bottles";
import type { BottleHttpDeps } from "./bottles-http";
const curated = seeds as Bottle[];
export function bottleDeps(): BottleHttpDeps {
  return {
    env: {
      DATABASE_URL: process.env.DATABASE_URL,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
    },
    seeds: curated,
    service: createBottleService({
      store: createPostgresBottleStore(db.$client),
      seeds: curated,
      secret: process.env.BETTER_AUTH_SECRET ?? "",
    }),
    actor: async () => {
      const session = await getSession();
      return session ? { id: session.user.id, role: session.user.role } : null;
    },
  };
}
