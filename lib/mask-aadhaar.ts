/**
 * Aadhaar masking.
 *
 * Only the last 4 digits are ever shown: the first 8 stay hidden for EVERY role,
 * on every screen, in every state. The unmasked value is never rendered as static
 * text — it is only ever placed in a focused input that the Maker opened to edit,
 * which re-masks on blur. That mirrors the onboarding journey behaviour.
 */
export function maskAadhaar(value?: string | null): string {
  if (!value) return "";
  const raw = String(value).replace(/[^0-9Xx]/g, "");
  if (raw.length < 4) return String(value);
  return `XXXX-XXXX-${raw.slice(-4)}`;
}

/** True when the value is a full 12-digit Aadhaar (i.e. there is something to mask). */
export function hasFullAadhaar(value?: string | null): boolean {
  if (!value) return false;
  return String(value).replace(/\D/g, "").length === 12;
}
