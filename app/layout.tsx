import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PhantomDS",
  description: "Dark notes and tasks workspace deployed on Vercel with private Blob sync."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
