import type { Metadata } from "next";
import { ViewTransition } from "react";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/og?title=Sign+in&path=%2Fsign-in", width: 1200, height: 630, alt: "Sign in, stamped on paper by otohime.dev" }],
  },
  twitter: { card: "summary_large_image" },
  title: "Sign in",
};

export default function SignInPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <SignInForm />
    </ViewTransition>
  );
}
