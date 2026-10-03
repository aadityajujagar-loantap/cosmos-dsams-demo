/**
 * Build-wide portal switch.
 *
 * web1-agent  -> "agent"  : DSA partners only. Email + password, no captcha, no OTP.
 * web2-branch -> "branch" : bank branch staff only. Username + password + captcha + OTP.
 *
 * Both branches keep the login route at /login; only this constant differs.
 *
 * This is deliberately a committed constant, not process.env.NEXT_PUBLIC_*: `.env*` is
 * gitignored, so an env var would not travel with the branch and both checkouts would
 * resolve to the same portal. Flip this one line per branch instead.
 */
export type PortalMode = "agent" | "branch";

/**
 * Takes the mode as a parameter rather than comparing the PORTAL constant inline:
 * TypeScript narrows a `const` initialised to a single literal to that literal, which
 * makes an inline `PORTAL === "agent"` comparison a type error.
 */
export function isPortalModeFor(mode: PortalMode) {
  return mode === "agent";
}

export const PORTAL: PortalMode = "agent";

/** Roles that belong to the DSA (external partner) portal. */
export const DSA_PORTAL_ROLES = ["DSA Partner", "DSA Agent"] as const;

export const isAgentPortal = isPortalModeFor(PORTAL);

/** The actual boundary rule, with the mode passed in so both branches can be exercised.
 * The agent portal admits only DSA roles; the branch portal admits everything else.
 * The backend independently enforces the DSA ACTIVE-status gate on /auth/dsa-login;
 * this only keeps the two frontend portals from being interchangeable.
 */
export function isRoleAllowedOnPortalFor(mode: PortalMode, role: string): boolean {
  const isDsaRole = (DSA_PORTAL_ROLES as readonly string[]).includes(role);
  return isPortalModeFor(mode) ? isDsaRole : !isDsaRole;
}

/** Whether the signed-in role may use this build of the UI. */
export function isRoleAllowedOnPortal(role: string): boolean {
  return isRoleAllowedOnPortalFor(PORTAL, role);
}