import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "HeapSim 3D · Heap-leach planning",
  description:
    "Interactive engineering planning for gold heap-leach operations. Shared physical geometry, deterministic scheduling, and material accounting.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
