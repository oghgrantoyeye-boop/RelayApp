"use client";
import { useEffect, useRef } from "react";

/** Keeps the conversation scrolled to the newest message when it opens or grows. */
export function ScrollToEnd({ count }: { count: number }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // Scroll only the conversation, never the page around it.
    const box = ref.current?.closest(".chat-scroll");
    if (box) box.scrollTop = box.scrollHeight;
  }, [count]);
  return <li ref={ref} aria-hidden="true" style={{ height: 1, listStyle: "none" }} />;
}
