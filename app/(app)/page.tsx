import { Doodle, Mascot, type DoodleName } from "@/components/doodles";
import { requireUser } from "@/lib/dal";
import { can, type Permissions } from "@/lib/permissions";
import Link from "next/link";

const rooms: { href: string; title: string; blurb: string; doodle: DoodleName; needs?: Permissions }[] = [
  {
    href: "/admin/users",
    title: "Users",
    blurb: "Roles, bans and sessions.",
    doodle: "fish",
    needs: { user: ["list"] },
  },
  {
    href: "/admin/roles",
    title: "Roles",
    blurb: "What each role can do.",
    doodle: "star",
    needs: { user: ["list"] },
  },
];

export default async function DashboardPage() {
  const { user } = await requireUser("/");
  const role = user.role ?? "user";
  const open = rooms.filter((room) => !room.needs || can(user.role, room.needs));

  return (
    <div className="rise">
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-[2rem] sm:text-[2.5rem]">
            Hi, <span className="squiggle">{user.name.split(" ")[0] || user.name}</span>!
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-muted">
            <span className="badge" data-role={role}>
              {role}
            </span>
            Signed in as {user.email}
          </p>
        </div>
        <Mascot className="ml-auto hidden w-28 text-ink sm:block" />
      </div>
      {open.length ? (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {open.map(({ href, title, blurb, doodle }) => (
            <li key={href}>
              <Link href={href} className="card card-link h-full">
                <span className="grid size-11 shrink-0 place-items-center rounded-[var(--wobble)] border-2 border-ink bg-sea-soft">
                  <Doodle name={doodle} className="wiggle size-6" />
                </span>
                <span>
                  <span className="block font-display text-lg font-bold">{title}</span>
                  <span className="text-sm text-muted">{blurb}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
