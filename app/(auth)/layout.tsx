import { BrandMark } from "@/components/brand-mark";
import { ScenePanel } from "@/components/scene-panel";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="card flex w-full max-w-[1040px] flex-col overflow-hidden md:min-h-[600px] md:flex-row">
        <div className="order-2 flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 md:order-1 md:px-14 md:py-12">
          <div className="rise mx-auto w-full max-w-sm">
            <BrandMark />
            <div className="mt-8">{children}</div>
          </div>
        </div>
        <ScenePanel />
      </div>
    </main>
  );
}
