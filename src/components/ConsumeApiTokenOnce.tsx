"use client";

import { useEffect } from "react";
import { consumeApiTokenOnce } from "@/app/actions";

/** Clears the one-time token cookie after the page has read it (RSC can't mutate cookies). */
export function ConsumeApiTokenOnce({ present }: { present: boolean }) {
  useEffect(() => {
    if (present) void consumeApiTokenOnce();
  }, [present]);
  return null;
}
