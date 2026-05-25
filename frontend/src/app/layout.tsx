import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "VedaAI – AI Assessment Creator",
  description:
    "Create structured, AI-powered question papers with intelligent section generation, difficulty balancing, and professional formatting.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
