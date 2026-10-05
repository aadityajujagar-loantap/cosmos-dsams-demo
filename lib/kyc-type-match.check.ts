// Mirrors the type-matching rules in components/screens/dsa-pages.tsx:
//  - getVerif()             : matches kyc_verifications.type
//  - isKycTypeVerified()    : matches kyc_verifications.type via codePatterns
// Before the fix both used `includes`, so PAN_TO_GSTIN satisfied the GST slot.

const TYPES = [
  "PAN",
  "PAN_ADVANCE",
  "PAN_ENTITY",
  "GST_BASIC",
  "PAN_TO_GSTIN",
  "UDYAM",
  "BANK_ACCOUNT",
  "BANK_ACCOUNT_PENNYLESS",
];

/** Old behaviour: plain substring match. */
const oldMatches = (t: string, pattern: string) => t.includes(pattern);

/** New behaviour: exact set membership when allowedTypes is given. */
const newMatches = (t: string, pattern: string, allowedTypes?: string[]) =>
  allowedTypes
    ? allowedTypes.some((a) => t === a.toUpperCase())
    : t.includes(pattern);

let failed = 0;
const check = (label: string, got: boolean, want: boolean) => {
  const ok = got === want;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}: got ${got}, want ${want}`,
  );
};

console.log("— GST slot must reject PAN_TO_GSTIN —");
for (const t of TYPES) {
  check(
    `new GST match ${t}`,
    newMatches(t, "GST", ["GST_BASIC"]),
    t === "GST_BASIC",
  );
}

console.log("\n— documents the original bug —");
check(
  "old GST match PAN_TO_GSTIN (was true = bug)",
  oldMatches("PAN_TO_GSTIN", "GST"),
  true,
);

console.log("\n— GST_BASIC still matches both —");
check("old GST match GST_BASIC", oldMatches("GST_BASIC", "GST"), true);
check("new GST match GST_BASIC", newMatches("GST_BASIC", "GST", ["GST_BASIC"]), true);

console.log("\n— PAN slot unaffected (no allowedTypes passed) —");
for (const t of ["PAN", "PAN_ADVANCE", "PAN_ENTITY", "GST_BASIC"]) {
  check(`new PAN match ${t}`, newMatches(t, "PAN"), oldMatches(t, "PAN"));
}

console.log(failed === 0 ? "\nKYC type matching OK" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
