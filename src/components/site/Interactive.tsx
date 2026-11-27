"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Adds a border under the nav once the page scrolls. */
export function NavShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className="nav" data-scrolled={scrolled}>
      {children}
    </header>
  );
}

/** Fades content up as it scrolls into view. Content is visible without JavaScript. */
export function Reveal({ children, as: Tag = "div", className = "", delay = 0 }: { children: ReactNode; as?: "div" | "section" | "li"; className?: string; delay?: number }) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"idle" | "hidden" | "in">("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return; // already on screen: no animation
    setState("hidden");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setState("in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const cls = state === "idle" ? className : `${className} reveal${state === "in" ? " in" : ""}`;
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={cls} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  );
}

/** Lights each workflow step and fills the beam as the reader scrolls through them. */
export function StepBeam({ children, count }: { children: ReactNode; count: number }) {
  const ref = useRef<HTMLOListElement>(null);
  const [lit, setLit] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const steps = Array.from(el.querySelectorAll<HTMLElement>(".step"));
    const update = () => {
      const mid = window.innerHeight * 0.62;
      let n = 0;
      steps.forEach((s, i) => {
        if (s.getBoundingClientRect().top < mid) n = i + 1;
      });
      setLit(n);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  useEffect(() => {
    ref.current?.querySelectorAll(".step").forEach((s, i) => s.classList.toggle("lit", i < lit));
  }, [lit]);
  const pct = count <= 1 ? 100 : Math.min(100, (Math.max(lit - 1, 0) / (count - 1)) * 100);
  return (
    <ol className="steps" ref={ref} style={{ ["--beam" as string]: `${pct}%` }}>
      <span className="beam" aria-hidden="true" />
      {children}
    </ol>
  );
}
