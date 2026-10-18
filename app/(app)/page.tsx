import { FigTitle, Figure } from "@/components/figures";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in?next=%2F");
  const { name, email } = session.user;

  return (
    <div className="rise">
      <FigTitle n="01" hint={`signed in as ${email}`}>
        Hello, {name.split(" ")[0] || name}
      </FigTitle>
      <Figure kind="open-lock" className="mx-auto mt-6 block w-full max-w-sm" />
    </div>
  );
}
