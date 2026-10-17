import { AccountStatus } from "@/components/account-status";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-24">
      <p className="text-sm uppercase tracking-[0.22em] text-zinc-500">
        otohime.dev
      </p>
      <h1 className="mt-3 text-5xl font-semibold tracking-tight">Otohime</h1>
      <p className="mt-4 max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        A personal web app. Pages, the API, and Postgres live in this project.
      </p>
      <div className="mt-8">
        <AccountStatus />
      </div>
    </main>
  );
}
