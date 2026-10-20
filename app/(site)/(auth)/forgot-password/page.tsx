import { FigTitle } from "@/components/figures";
import { ForgotPasswordForm } from "@/components/password-reset-forms";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <FigTitle n="02">Forgot password</FigTitle>
      <p className="mt-2 text-muted">Type your email and we&apos;ll send a link to choose a new password.</p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6">
        <Link href="/sign-in" className="link">
          <span aria-hidden="true">←</span> Back to sign in
        </Link>
      </p>
    </ViewTransition>
  );
}
