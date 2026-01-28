import { ReactNode } from "react";
import { ProgressBar } from "@/components/create/ProgressBar";
import { WizardProvider } from "@/components/create/WizardProvider";

export default function CreateLayout({ children }: { children: ReactNode }) {
  return (
    <WizardProvider>
      <div className="min-h-screen w-full bg-black relative overflow-hidden">
        {/* Fondo degradado Pixia */}
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/10 via-indigo-500/10 to-cyan-400/10 blur-3xl" />

        {/* Contenido */}
        <div className="relative z-10 flex min-h-screen flex-col items-center px-4 py-10">
          {/* Progress */}
          <div className="w-full max-w-4xl mb-10">
            <ProgressBar />
          </div>

          {/* Wizard container */}
          <main className="w-full max-w-4xl flex-1 flex items-center justify-center">
            {children}
          </main>
        </div>
      </div>
    </WizardProvider>
  );
}
