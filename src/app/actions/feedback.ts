"use server";
// Answer feedback (T-21). The library re-checks that the viewer asked the question.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentViewer } from "@/lib/session";
import { rateAnswer } from "@/lib/feedback";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function rateAnswerAction(form: FormData): Promise<void> {
  const vote = str(form, "vote") === "down" ? "down" : "up";
  const back = str(form, "back");
  const safe = /^\/(teams\/[a-z0-9-]+(\?[\w=&%-]*)?|messages(\?[\w=&%-]*)?|agents\/[a-z0-9-]+[\w/?=&%-]*|questions(\?[\w=&%-]*)?)$/i.test(back) ? back : "/questions";
  const { db, viewer } = await currentViewer();
  await rateAnswer(db, viewer, str(form, "questionId"), vote, str(form, "note"));
  revalidatePath(safe.split("?")[0]);
  const sep = safe.includes("?") ? "&" : "?";
  redirect(`${safe}${sep}rated=${vote}`);
}
