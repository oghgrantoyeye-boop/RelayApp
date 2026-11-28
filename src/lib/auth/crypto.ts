import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { authSecret } from "./config";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHmac("sha256", authSecret()).update(token).digest("hex");
}

export function tokensEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
