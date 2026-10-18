import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
} from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { db } from "../db/client";
import * as schema from "../db/schema";
import { mayAct, roles } from "./permissions";

// /admin/* endpoints that act on nobody else. Every other /admin/* path must
// name a target the actor outranks, or it is refused (fail closed).
const NO_TARGET = new Set([
  "/admin/list-users",
  "/admin/get-user",
  "/admin/has-permission",
  "/admin/stop-impersonating",
]);

// Better Auth's admin routes check the actor's permission but never the
// target's rank; this adds the rank rule (see mayAct) in front of all of them.
const roleHierarchy = createAuthMiddleware(async (ctx) => {
  if (!ctx.path.startsWith("/admin/") || NO_TARGET.has(ctx.path)) return;
  const session = await getAuthoritativeSessionFromCtx(ctx);
  if (!session) throw APIError.fromStatus("UNAUTHORIZED");

  // Raw body: the endpoint's zod schema hasn't run yet.
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  const data = (body.data && typeof body.data === "object" ? body.data : {}) as Record<
    string,
    unknown
  >;
  let targetRole: string | null | undefined; // undefined: a user about to be created
  let newRoles: unknown[] | undefined;

  if (ctx.path === "/admin/create-user") {
    newRoles = [body.role ?? data.role ?? "user"].flat();
  } else {
    const target =
      ctx.path === "/admin/revoke-user-session"
        ? typeof body.sessionToken === "string"
          ? (await ctx.context.internalAdapter.findSession(body.sessionToken))?.user
          : null
        : body.userId == null
          ? null
          : // String() matches the endpoint's z.coerce.string()
            await ctx.context.internalAdapter.findUserById(String(body.userId));
    if (!target) throw APIError.fromStatus("FORBIDDEN", { message: "Unknown target" });
    targetRole = (target as { role?: string | null }).role ?? null;
    if (ctx.path === "/admin/set-role") newRoles = [body.role].flat();
    if (ctx.path === "/admin/update-user" && Object.hasOwn(data, "role")) {
      newRoles = [data.role].flat();
    }
  }

  if (!mayAct(session.user.role, targetRole, newRoles)) {
    throw APIError.from("FORBIDDEN", {
      code: "ROLE_HIERARCHY",
      message: "You can only manage users below your role.",
    });
  }
});

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:4000",
    "https://otohime.dev",
    "https://www.otohime.dev",
  ],
  // adminRoles also makes owners need impersonate-admins to be impersonated.
  plugins: [admin({ roles, adminRoles: ["owner", "admin"] })],
  hooks: { before: roleHierarchy },
});
