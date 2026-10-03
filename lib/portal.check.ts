/**
 * Runnable self-check for the portal boundary. Kept out of portal.ts so the asserts
 * never execute in the browser bundle. Run with:  npx tsx lib/portal.check.ts
 */
import assert from "node:assert/strict";

import {
  DSA_PORTAL_ROLES,
  PORTAL,
  isPortalModeFor,
  isRoleAllowedOnPortal,
  isRoleAllowedOnPortalFor,
} from "./portal";

const STAFF_ROLES = [
  "DSA Manager",
  "DSA Credit",
  "Branch User",
  "Checker",
  "Sub-Region Head",
  "DGM",
  "Region Head",
  "HO Credit Officer",
  "HO Credit Head",
  "Customer",
];

// Every role the app can resolve must be admitted by exactly one portal.
for (const role of [...DSA_PORTAL_ROLES, ...STAFF_ROLES]) {
  const inAgent = isRoleAllowedOnPortalFor("agent", role);
  const inBranch = isRoleAllowedOnPortalFor("branch", role);
  assert.notEqual(inAgent, inBranch, `role "${role}" must belong to exactly one portal`);
}

// A DSA role is allowed on the agent portal and only there.
for (const role of DSA_PORTAL_ROLES) {
  assert.equal(isRoleAllowedOnPortalFor("agent", role), true, `agent/${role}`);
  assert.equal(isRoleAllowedOnPortalFor("branch", role), false, `branch/${role}`);
}

// Staff roles are allowed on the branch portal and only there.
for (const role of STAFF_ROLES) {
  assert.equal(isRoleAllowedOnPortalFor("branch", role), true, `branch/${role}`);
  assert.equal(isRoleAllowedOnPortalFor("agent", role), false, `agent/${role}`);
}

// Both portals must admit someone, otherwise one branch would be unusable.
assert.ok(DSA_PORTAL_ROLES.some((r) => isRoleAllowedOnPortalFor("agent", r)));
assert.ok(STAFF_ROLES.some((r) => isRoleAllowedOnPortalFor("branch", r)));

// The committed PORTAL must match the isAgentPortal flag and the default helper.
assert.ok(["agent", "branch"].includes(PORTAL), `unknown PORTAL "${PORTAL}"`);
assert.equal(isPortalModeFor(PORTAL), isRoleAllowedOnPortalFor(PORTAL, "DSA Partner"));

console.log(
  `portal boundary OK — PORTAL="${PORTAL}", ` +
    `DSA Partner allowed here: ${isRoleAllowedOnPortal("DSA Partner")}, ` +
    `Branch User allowed here: ${isRoleAllowedOnPortal("Branch User")}`,
);