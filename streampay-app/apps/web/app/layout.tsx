import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { WalletConnect } from "../components/WalletConnect";
import { ThemeToggle } from "../components/ThemeToggle";

export const metadata: Metadata = {
  title: "StreamPay | Continuous Streaming Payments on Stellar",
  description:
    "Non-custodial per-second streaming payments on Stellar Soroban. Pausable, cancellable, permissionlessly settleable.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-slate-950 transition-colors duration-200">
        <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 transition-colors duration-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition">
                  ⚡
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition">
                    StreamPay
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 -mt-1 font-mono">
                    Stellar Soroban
                  </span>
                </div>
              </Link>

              <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
                <Link
                  href="/"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                >
                  Dashboard
                </Link>
                <Link
                  href="/create"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                >
                  Create Stream
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <WalletConnect />
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
          {children}
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 py-6 text-center text-xs text-slate-500 transition-colors duration-200">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span>StreamPay — Continuous Value Transfer on Stellar Soroban</span>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-600">
              Wave 11 Maintainer Package
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
