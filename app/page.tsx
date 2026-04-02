"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-5 text-sm font-medium">
        Loading HUDD NEXUS workspace...
      </div>
    </div>
  );
}
