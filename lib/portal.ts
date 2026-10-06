/**
 * Build-wide portal switch.
 *
 * Controlled by NEXT_PUBLIC_PORTAL_MODE environment variable:
 *   - "agent"  : DSA partners only (web1-agent). Email + password + captcha.
 *   - "branch" : Bank branch staff only (web2-branch). Username + password + captcha + OTP.
 *
 * Both deployments keep the login route at /login; the env var decides which UI/API to use.
 * Defaults to "branch" if not set (safe default for internal staff portal).
 */
export type PortalMode = "agent" | "branch";

/** Read portal mode from env at build time; no runtime dependency on process.env. */
const getPortalMode = (): PortalMode => {
  const envMode = process.env.NEXT_PUBLIC_PORTAL_MODE;
  if (envMode === "agent" || envMode === "branch") return envMode;
  // Default to branch (staff portal) for safety — prevents accidental DSA exposure
  return "branch";
};

/**
 * Takes the mode as a parameter rather than comparing the PORTAL constant inline:
 * TypeScript narrows a `const` initialised to a single literal to that literal, which
 * makes an inline `PORTAL === "agent"` comparison a type error.
 */
export function isPortalModeFor(mode: PortalMode) {
  return mode === "agent";
}

export const PORTAL: PortalMode = getPortalMode();

/** Roles that belong to the DSA (external partner) portal. */
export const DSA_PORTAL_ROLES = ["DSA Partner", "DSA Agent"] as const;

export const isAgentPortal = isPortalModeFor(PORTAL);
/** Shown when valid credentials belong to the other portal. */
export const PORTAL_DENIED_MESSAGE: Record<PortalMode, string> = {
  agent:
    "Unauthorized: this account is not a DSA partner. Use the bank staff portal to sign in with these credentials.",
  branch:
    "Unauthorized: DSA partners cannot sign in here. Use the DSA partner portal to sign in with these credentials.",
};

export function portalDeniedMessage(mode: PortalMode = PORTAL): string {
  return PORTAL_DENIED_MESSAGE[mode];
}

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