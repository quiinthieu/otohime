import { FigTitle } from "@/components/figures";
import { ResetPasswordForm } from "@/components/password-reset-forms";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "New password" };

export default function ResetPasswordPage() {
  return (
    <>
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
    </>
  );
}
