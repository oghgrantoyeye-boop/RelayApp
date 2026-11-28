"use server";
// Team context corrections from the team page. The library re-checks that the viewer is on the
// entry's team, so the buttons being hidden for others is never the only protection.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentViewer } from "@/lib/session";
import { confirmEntry, editEntry, restoreEntry, retireEntry, unsureEntry } from "@/lib/context";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function act(form: FormData, fn: (id: string) => Promise<string>): Promise<never> {
  const slug = str(form, "slug").replace(/[^a-z0-9-]/gi, "");
  // The team queue shows what Beacon learned from an answer and lets the answerer confirm it there.
  const from = str(form, "back");
  const asks = /^\/asks(\?[\w=&%-]*)?$/.test(from) ? from : null;
  const back = asks ?? `/teams/${slug}`;
  let msg: string;
  try {
    msg = await fn(str(form, "id"));
  } catch (e) {
    msg = `Error: ${(e as Error).message}`;
  }
  revalidatePath(asks ? "/asks" : back);
  redirect(asks ? `${asks}${asks.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}` : `${back}?msg=${encodeURIComponent(msg)}#knows`);
}

export async function confirmContext(form: FormData) {
  return act(form, async (id) => {
    const { db, viewer } = await currentViewer();
    await confirmEntry(db, viewer, id);
    return "Confirmed. Beacon will use it with more confidence.";
  });
}

export async function fixContext(form: FormData) {
  return act(form, async (id) => {
    const { db, viewer } = await currentViewer();
    await editEntry(db, viewer, id, { title: str(form, "title"), body: str(form, "body") });
    return "Saved your fix. It replaces what Beacon learned.";
  });
}

export async function removeContext(form: FormData) {
  return act(form, async (id) => {
    const { db, viewer } = await currentViewer();
    await retireEntry(db, viewer, id);
    return "Removed. Beacon won't learn it again from the same sources. You can undo it under Removed.";
  });
}

export async function restoreContext(form: FormData) {
  return act(form, async (id) => {
    const { db, viewer } = await currentViewer();
    await restoreEntry(db, viewer, id);
    return "Restored.";
  });
}

export async function unsureContext(form: FormData) {
  return act(form, async (id) => {
    const { db, viewer } = await currentViewer();
    await unsureEntry(db, viewer, id);
    return "Thanks. Beacon will ask someone else on the team.";
  });
}
