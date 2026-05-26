import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "@/styles/globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
});

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
    <html lang="en" className={`${bricolage.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
