import { ageFromIsoDob } from "@/components/screens/dsa-onboarding-form";

const now = new Date();
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const expected = (y: number, m: number, d: number) => {
  let a = now.getFullYear() - y;
  const before =
    now.getMonth() - (m - 1) < 0 ||
    (now.getMonth() === m - 1 && now.getDate() < d);
  if (before) a -= 1;
  return String(a);
};

let failed = 0;
const check = (label: string, got: string, want: string) => {
  const ok = got === want;
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

// Blank DOB must yield a blank age so the field stays editable.
check("empty dob", ageFromIsoDob(""), "");
check("invalid dob", ageFromIsoDob("not-a-date"), "");

// Non-leap and leap birthdays, plus today's exact date.
for (const [y, m, d] of [
  [1990, 3, 15],
  [2000, 2, 29],
  [1985, 12, 31],
  [now.getFullYear(), now.getMonth() + 1, now.getDate()],
  [now.getFullYear() - 18, 1, 1],
] as [number, number, number][]) {
  check(`dob ${iso(y, m, d)}`, ageFromIsoDob(iso(y, m, d)), expected(y, m, d));
}

// A future DOB must never produce a negative age string.
const future = iso(now.getFullYear() + 5, 6, 15);
check("future dob", ageFromIsoDob(future), "");

console.log(failed === 0 ? "\nage derivation OK" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
