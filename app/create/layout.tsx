"use client";

import { ProgressBar } from "@/components/create/ProgressBar";
import { WizardProvider } from "@/components/create/WizardProvider";

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WizardProvider>
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white flex flex-col">
        
        {/* Progress bar sticky */}
        <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-white/10">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <ProgressBar />
          </div>
        </div>

        {/* Content scrollable */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-12 pb-40">
            {children}
          </div>
        </main>

      </div>
    </WizardProvider>
  );
}
