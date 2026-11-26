"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appDb } from "@/lib/app-db";
import { ENTITY_TYPE, audit, loadAllRaw, shareOnTrigger } from "@/lib/entities";
import { LEVELS } from "@/lib/levels";
import { loadPermissionContext } from "@/lib/permissions";
import { PERSONA_COOKIE, currentPersona } from "@/lib/session";

export async function setPersona(form: FormData) {
  const id = String(form.get("member") ?? "");
  const back = String(form.get("back") ?? "/");
  (await cookies()).set(PERSONA_COOKIE, id, { path: "/", sameSite: "lax" });
  redirect(back.startsWith("/") ? back : "/");
}

/** Only members of the interface's owning unit may change it. */
async function ownInterface(id: string) {
  const db = await appDb();
  const me = await currentPersona();
  const r = await db.query<{ id: string; from_unit_id: string; to_unit_id: string; field_id: string; level: string; status: string }>(
    "select id, from_unit_id, to_unit_id, field_id, level, status from interface where id = $1",
    [id],
  );
  const iface = r.rows[0];
  if (!iface || iface.from_unit_id !== me.unit_id) throw new Error("Only members of the sharing team can change this interface");
  return { db, me, iface };
}

/** After an interface turns on, send the receiving team what it now gets, so their feed updates right away. */
async function backfill(ifaceId: string, actor: string) {
  const db = await appDb();
  const ctx = await loadPermissionContext(db, ENTITY_TYPE);
  const r = await db.query<{ field_id: string; trigger: string }>("select field_id, trigger from interface where id = $1", [ifaceId]);
  const { field_id, trigger } = r.rows[0];
  const field = ctx.fields.get(field_id)!;
  for (const raw of await loadAllRaw(db, ctx)) {
    if (raw.values.get(field_id) === undefined) continue;
    await shareOnTrigger(db, ctx, raw, field, trigger.split("+")[0], actor);
  }
}

export async function decideSuggestion(form: FormData) {
  const id = String(form.get("id"));
  const choice = String(form.get("choice")); // approve | summary | decline
  const { db, me, iface } = await ownInterface(id);
  if (iface.status !== "suggested" && iface.status !== "requested") return;
  if (choice === "decline") {
    await db.query("update interface set status = 'declined' where id = $1", [id]);
  } else {
    const level = choice === "summary" ? "summary" : iface.level;
    await db.query("update interface set status = 'active', level = $2 where id = $1", [id, level]);
  }
  await audit(db, { actor: me.id, action: `interface_${choice}`, target: id, toUnit: iface.to_unit_id, detail: { field: iface.field_id } });
  if (choice !== "decline") await backfill(id, me.id);
  revalidatePath("/", "layout");
}

export async function setInterfaceLevel(form: FormData) {
  const id = String(form.get("id"));
  const level = String(form.get("level"));
  const { db, me, iface } = await ownInterface(id);
  if (level === "none") {
    await db.query("update interface set status = 'declined' where id = $1", [id]);
  } else if ((LEVELS as readonly string[]).includes(level)) {
    await db.query("update interface set level = $2 where id = $1", [id, level]);
  } else return;
  await audit(db, { actor: me.id, action: "interface_level", target: id, toUnit: iface.to_unit_id, detail: { from: iface.level, to: level } });
  revalidatePath("/", "layout");
}

export async function createInterface(form: FormData) {
  const db = await appDb();
  const me = await currentPersona();
  const to = String(form.get("to"));
  const fieldId = String(form.get("field"));
  const level = String(form.get("level"));
  const trigger = String(form.get("trigger"));
  const f = await db.query<{ owner_unit_id: string; label: string }>("select owner_unit_id, label from field where id = $1", [fieldId]);
  if (!f.rows[0] || f.rows[0].owner_unit_id !== me.unit_id) throw new Error("You can only share fields your team owns");
  if (!["full", "summary", "status", "headline"].includes(level) || to === me.unit_id) return;
  const id = `if_${Date.now().toString(36)}`;
  await db.query(
    `insert into interface (id, from_unit_id, to_unit_id, field_id, level, trigger, status, label) values ($1, $2, $3, $4, $5, $6, 'active', $7)`,
    [id, me.unit_id, to, fieldId, level, trigger, f.rows[0].label],
  );
  await audit(db, { actor: me.id, action: "interface_create", target: id, toUnit: to, detail: { field: fieldId, level, trigger } });
  await backfill(id, me.id);
  revalidatePath("/", "layout");
}
