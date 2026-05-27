import "./globals.css";

export const metadata = {
  title: "Pixia – AI Photo Stories",
  description: "Create cinematic photo albums powered by AI",
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
