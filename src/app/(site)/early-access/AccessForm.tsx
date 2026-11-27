"use client";
import { useActionState } from "react";
import Link from "next/link";
import { requestAccess, type AccessState } from "./actions";

export function AccessForm({ source }: { source: string }) {
  const [state, action, pending] = useActionState<AccessState, FormData>(requestAccess, { status: "idle" });

  if (state.status === "ok") {
    return (
      <div className="success" role="status">
        <span className="eyebrow">Request received</span>
        <h2 className="h2" style={{ fontSize: 32, marginTop: 14 }}>You&apos;re on the list.</h2>
        <p className="muted" style={{ marginTop: 12 }}>
          We&apos;ll be in touch about early access. In the meantime, you can explore the working prototype with a fictional company.
        </p>
        <div className="hero-ctas" style={{ marginTop: 20 }}>
          <Link className="btn btn-primary" href="/feed">Try the interactive demo <span className="arrow" aria-hidden="true">→</span></Link>
          <Link className="btn btn-ghost" href="/">Back to the site</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="form" action={action} noValidate={false}>
      <input type="hidden" name="source" value={source} />
      <div className="hp" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="company">Company</label>
          <input id="company" name="company" autoComplete="organization" />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="role">Your role</label>
          <select id="role" name="role" defaultValue="">
            <option value="" disabled>Choose one</option>
            <option>Leadership or chief of staff</option>
            <option>Product</option>
            <option>Engineering</option>
            <option>Operations</option>
            <option>Other</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="teamSize">Company size</label>
          <select id="teamSize" name="teamSize" defaultValue="">
            <option value="" disabled>Choose one</option>
            <option>Under 50</option>
            <option>50 to 200</option>
            <option>200 to 2,000</option>
            <option>Over 2,000</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="note">Where does coordination break down for you today?</label>
        <span className="hint">Optional. A sentence or two helps us prioritize.</span>
        <textarea id="note" name="note" rows={4} />
      </div>
      {state.status === "error" && <p className="err" role="alert">{state.error}</p>}
      <div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Request early access"} {!pending && <span className="arrow" aria-hidden="true">→</span>}
        </button>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>We&apos;ll only use your details to contact you about Beacon.</p>
    </form>
  );
}
