// Site-wide roles. Pure and package-only imports, so `node --test` loads it as-is.
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";

// Better Auth statements plus owner songs and owner/admin Bottle moderation.
export const ac = createAccessControl({
  ...defaultStatements,
  song: ["create", "delete"],
  bottle: ["moderate"],
});

export const statements = ac.statements;

// Highest first: the roles page renders its columns in this order.
export const roles = {
  owner: ac.newRole(ac.statements), // everything, incl. impersonate-admins and song
  admin: ac.newRole({ ...adminAc.statements, bottle: ["moderate"] }), // Better Auth's admin set; no song
  user: ac.newRole({ ...userAc.statements }), // nothing
};

export type RoleName = keyof typeof roles;
export type Permissions = Parameters<(typeof roles)["user"]["authorize"]>[0];

const RANK: Record<RoleName, number> = { owner: 3, admin: 2, user: 1 };

// Same parsing as Better Auth's has-permission: empty means "user", commas mean several roles.
const split = (role?: string | null) => (role || "user").split(",");
// Object.hasOwn keeps "constructor", "__proto__" and friends out.
const known = (role: unknown): role is RoleName =>
  typeof role === "string" && Object.hasOwn(RANK, role);

export const rankOf = (role?: string | null) =>
  Math.max(0, ...split(role).map((r) => (known(r) ? RANK[r] : 0)));

export const can = (role: string | null | undefined, permissions: Permissions) =>
  split(role).some((r) => known(r) && roles[r].authorize(permissions).success);

/**
 * The rank rule Better Auth's admin routes don't check: the actor must
 * strictly outrank the target, and may only hand out single, known roles
 * below their own. Owners are therefore only ever made with SQL.
 */
export function mayAct(
  actor: string | null | undefined,
  target: string | null | undefined,
  newRoles?: unknown[],
) {
  const rank = rankOf(actor);
  if (rank <= rankOf(target)) return false;
  return (
    newRoles === undefined ||
    (newRoles.length > 0 && newRoles.every((r) => known(r) && RANK[r] < rank))
  );
}
