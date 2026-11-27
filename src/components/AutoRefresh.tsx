"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the page every few seconds while something is still running. */
export function AutoRefresh({ active, ms = 2500 }: { active: boolean; ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [active, ms, router]);
  return null;
}
