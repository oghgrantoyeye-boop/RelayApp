// The demo organizations Beacon can load. One is active at a time; its id is kept in org.settings.
import type { DemoPack } from "./types";
import { northwind } from "./northwind";
import { harborview } from "./harborview";
import { haldenMoss } from "./halden-moss";
import { maisonVerel } from "./maison-verel";
import { lakeportCourier } from "./lakeport-courier";

export const DEMOS: DemoPack[] = [northwind, harborview, haldenMoss, maisonVerel, lakeportCourier];
/** The demos offered on the picker: the others wait until their story is rewritten (T-51). */
export const LISTED_DEMOS: DemoPack[] = DEMOS.filter((d) => !d.hidden);
export const DEFAULT_DEMO = process.env.RELAY_DEMO && DEMOS.some((d) => d.id === process.env.RELAY_DEMO) ? process.env.RELAY_DEMO : northwind.id;

export function getDemo(id: string | null | undefined): DemoPack {
  return DEMOS.find((d) => d.id === id) ?? DEMOS.find((d) => d.id === DEFAULT_DEMO)!;
}

export type { DemoPack } from "./types";
