import "./globals.css";
import type { Viewport } from "next";

export const metadata = {
  title: "Pixia – AI Photo Stories",
  description: "Create cinematic photo albums powered by AI",
};

// viewportFit:'cover' es lo que hace que env(safe-area-inset-*) devuelva algo
// distinto de 0 en iOS (notch/home indicator) — sin esto, los paneles fijos
// del editor que usan env(safe-area-inset-bottom) no tendrían ningún efecto real.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-br from-black via-zinc-900 to-black text-white min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
