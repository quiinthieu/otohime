import { Mascot } from "@/components/doodles";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const instant = false;

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in?next=%2F");
  const { name, email } = session.user;

  return (
    <div className="rise flex items-center gap-6">
      <div>
        <h1 className="text-[2rem] sm:text-[2.5rem]">
          Hi, <span className="squiggle">{name.split(" ")[0] || name}</span>!
        </h1>
        <p className="mt-2 text-muted">Signed in as {email}</p>
      </div>
      <Mascot className="ml-auto hidden w-28 text-ink sm:block" />
    </div>
  );
}
