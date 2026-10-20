import type { Metadata } from "next";
import { ViewTransition } from "react";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <SignInForm />
    </ViewTransition>
  );
}
