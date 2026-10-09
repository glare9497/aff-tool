import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "vietnamese"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aff Tools",
  description: "Quản lý link affiliate và thống kê doanh thu",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/links", label: "Links" },
  { href: "/scripts", label: "AI kịch bản" },
  { href: "/posts", label: "Bài đăng" },
  { href: "/accounts", label: "Tài khoản" },
  { href: "/import", label: "Import đơn" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-border bg-card">
          <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <span className="font-semibold text-accent">Aff Tools</span>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-sm text-muted hover:text-foreground">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
