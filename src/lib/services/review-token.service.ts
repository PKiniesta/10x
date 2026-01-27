import crypto from "node:crypto";

/** MVP: losowy token (bez podpisu i bez weryfikacji). */
export function signReviewToken(_args: { userId: string; generationId: string; now: Date }): string {
  return crypto.randomUUID();
}
