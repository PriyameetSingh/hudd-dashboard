import { Metadata } from "next";
import LoginGrid from "@/components/LoginGrid";
import TextSizeToolbarControl from "@/components/TextSizeToolbarControl";

export const metadata: Metadata = {
  title: "HUDD Login",
  description: "Role-based entry to the HUDD dashboard",
};

export default function Page() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(28,33,65,0.45),_rgba(7,9,18,0.95))] text-white">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className="mx-auto w-full max-w-5xl space-y-10 rounded-3xl border border-white/10 bg-white/5 p-10 shadow-[0_0_60px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex justify-end">
            <TextSizeToolbarControl compact />
          </div>
          <header className="space-y-3 text-center">
            <p className="text-xs uppercase tracking-[0.5em] text-slate-300">Government of Odisha</p>
            <h1 className="text-4xl font-semibold tracking-[0.15em]">HUDD </h1>
            <p className="text-sm text-slate-300">Select your role to continue (Prototype Mode)</p>
          </header>
          <LoginGrid />
          <p className="text-center text-[11px] text-slate-400">
            Prototype version — mock authentication only. Production system will use HUDD organisational credentials.
          </p>
        </div>
      </div>
    </main>
  );
}
