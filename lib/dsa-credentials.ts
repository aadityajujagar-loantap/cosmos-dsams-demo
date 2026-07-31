import type { Dsa } from "@/lib/types";

const DSA_BRANCH_CREDENTIAL_PATTERN = /^cosdsa@branch(\d+)\.in$/;

export function makeDsaCredentials(branchNumber: number) {
  const safeBranchNumber = Math.max(1, Math.floor(branchNumber));
  return {
    branchNumber: safeBranchNumber,
    loginPassword: `branch${safeBranchNumber}@123`,
    loginUsername: `cosdsa@branch${safeBranchNumber}.in`,
  };
}

function credentialBranchNumber(value?: string) {
  const match = DSA_BRANCH_CREDENTIAL_PATTERN.exec(String(value ?? "").trim().toLowerCase());
  if (!match) return 0;
  return Number(match[1]) || 0;
}

export function nextDsaBranchNumber(dsas: Pick<Dsa, "loginUsername">[]) {
  const maxBranchNumber = dsas.reduce(
    (max, dsa) => Math.max(max, credentialBranchNumber(dsa.loginUsername)),
    0,
  );
  return maxBranchNumber + 1;
}

export function generateDsaCredentials(dsas: Pick<Dsa, "loginUsername">[]) {
  return makeDsaCredentials(nextDsaBranchNumber(dsas));
}
