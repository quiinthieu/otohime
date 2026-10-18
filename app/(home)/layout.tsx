import { Masthead } from "@/components/masthead";

// The entrance at /: the masthead and the page, no sidebar. The console on
// the page is the way in.
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Masthead />
      <main id="main" tabIndex={-1} className="min-w-0 outline-none">
        <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8 lg:py-8">{children}</div>
      </main>
    </>
  );
}
