/** Prefix pack-local ids so several sample workspaces can sit in one database. */
export function scoped(orgId: string, local: string): string {
  if (!local) return local;
  if (local.startsWith(`${orgId}__`)) return local;
  return `${orgId}__${local}`;
}

export function scopedOpt(orgId: string, local: string | null | undefined): string | null {
  if (local == null || local === "") return null;
  return scoped(orgId, local);
}

export function scopedMany(orgId: string, locals: string[] | null | undefined): string[] {
  return (locals ?? []).map((x) => scoped(orgId, x));
}

/** Map a pack-local person id to the seeded app_user id. */
export function scopedPersona(orgId: string, localPersona: string): string {
  return scoped(orgId, localPersona);
}

/** Strip the org prefix from a scoped id; leave other ids unchanged. */
export function localId(orgId: string, id: string): string {
  const prefix = `${orgId}__`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}
