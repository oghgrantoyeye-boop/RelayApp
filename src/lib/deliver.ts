// Every message Relay sends lands in the recipient's in-app inbox. When SLACK_WEBHOOK_URL is set,
// it is also posted to Slack. Email delivery would plug in here the same way.
import type { Db } from "./db";
import { now } from "./clock";
import { newId } from "./data";

export interface DeliveryInput {
  kind: string;
  subject: string;
  body: string;
  refs?: { type: string; id: string; href?: string }[];
}

export async function deliver(db: Db, recipientIds: string[], d: DeliveryInput): Promise<number> {
  const unique = [...new Set(recipientIds)];
  for (const id of unique) {
    await db.query(
      `insert into delivery (id, recipient_id, kind, subject, body, refs, created_at) values ($1, $2, $3, $4, $5, $6, $7)`,
      [newId("dl"), id, d.kind, d.subject, d.body, JSON.stringify(d.refs ?? []), now()],
    );
  }
  const hook = process.env.SLACK_WEBHOOK_URL;
  if (hook && unique.length > 0) {
    fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `*${d.subject}*\n${d.body}` }),
    }).catch(() => {});
  }
  return unique.length;
}
