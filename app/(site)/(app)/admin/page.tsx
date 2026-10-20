import { redirect } from "next/navigation";
import { ViewTransition } from "react";

export default function AdminPage() {
  redirect("/admin/users");
  // Never reached (redirect() throws); it keeps every site page wrapped, as lib/motion.test.ts asks.
  return <ViewTransition enter="page-in" exit="page-out" default="none" />;
}
