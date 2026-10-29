import { FigTitle } from "@/components/figures";
import { ResetPasswordForm } from "@/components/password-reset-forms";
import type { Metadata } from "next";
import { Suspense, ViewTransition } from "react";

export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/og?title=New+password&path=%2Freset-password", width: 1200, height: 630, alt: "New password, stamped on paper by otohime.dev" }],
  },
  twitter: { card: "summary_large_image" },
  title: "New password",
};

export default function ResetPasswordPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <FigTitle n="03">New password</FigTitle>
      <p className="mt-2 text-muted">
        Choose a new password. Every device signed in to your account will be signed out.
      </p>
      <div className="mt-6">
        {/* the form reads ?token= */}
        <Suspense fallback={<div className="skeleton h-40" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </ViewTransition>
  );
}
