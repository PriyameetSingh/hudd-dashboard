import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DataProvider } from "@/context/DataContext";
import MockAuthProvider from "@/components/MockAuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "HUDD NEXUS — Odisha Urban Governance",
  description: "Agentic intelligence platform for Housing & Urban Development Department, Government of Odisha",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full dark">
      <body className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <ThemeProvider>
          <DataProvider>
            {children}
            <MockAuthProvider />
          </DataProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
