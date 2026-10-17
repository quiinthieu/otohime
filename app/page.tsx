import { AccountStatus } from "@/components/account-status";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col justify-end px-6 pb-16 md:px-16 md:pb-24">
      <div className="border-l border-tide pl-6 md:pl-8">
        <h1 className="name-in font-display text-6xl leading-none font-light tracking-tight text-depth md:text-8xl">
          Otohime
        </h1>
        <p className="mt-5 max-w-sm text-lg leading-7 text-mist">
          A personal place at otohime.dev.
        </p>
        <div className="mt-8">
          <AccountStatus />
        </div>
      </div>
    </main>
  );
}
