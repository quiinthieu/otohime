import { ScenePanel } from "@/components/scene-panel";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="card flex w-full max-w-[1040px] flex-col overflow-hidden md:min-h-[640px] md:flex-row">
        <div className="order-2 flex flex-1 flex-col items-center justify-center px-6 py-10 sm:px-10 md:order-1 md:px-14 md:py-12">
          <div className="surface-in w-full max-w-[360px]">{children}</div>
        </div>
        <ScenePanel />
      </div>
    </main>
  );
}
