import type { ApplicationDeviation, Product } from "@/lib/types";
import { makeId } from "@/lib/utils";

interface BreInput {
  creditScore: number;
  loanAmount: number;
  product: Product;
  riskScore: number;
  salary: number;
}

interface BreProfile {
  minCreditScore: number;
  minMonthlyIncome: number;
  maxLoanToMonthlyIncome: number;
}

const breProfiles: Record<Product, BreProfile> = {
  "Personal Loan": {
    maxLoanToMonthlyIncome: 24,
    minCreditScore: 700,
    minMonthlyIncome: 25000,
  },
  "Home Loan": {
    maxLoanToMonthlyIncome: 120,
    minCreditScore: 680,
    minMonthlyIncome: 35000,
  },
  "Loan Against Property": {
    maxLoanToMonthlyIncome: 96,
    minCreditScore: 690,
    minMonthlyIncome: 40000,
  },
  "Business Loan": {
    maxLoanToMonthlyIncome: 72,
    minCreditScore: 700,
    minMonthlyIncome: 50000,
  },
  "Auto Loan": {
    maxLoanToMonthlyIncome: 36,
    minCreditScore: 680,
    minMonthlyIncome: 25000,
  },
};

function money(value: number) {
  return `INR ${Math.round(value).toLocaleString("en-IN")}`;
}

export function evaluateBreDeviation({
  creditScore,
  loanAmount,
  product,
  riskScore,
  salary,
}: BreInput) {
  const profile = breProfiles[product];
  const reasons: string[] = [];
  const loanToMonthlyIncome = salary > 0 ? loanAmount / salary : Number.POSITIVE_INFINITY;

  if (creditScore < profile.minCreditScore) {
    reasons.push(`Bureau score ${creditScore} is below ${profile.minCreditScore} for ${product}.`);
  }

  if (salary < profile.minMonthlyIncome) {
    reasons.push(`Declared monthly income ${money(salary)} is below ${money(profile.minMonthlyIncome)}.`);
  }

  if (loanToMonthlyIncome > profile.maxLoanToMonthlyIncome) {
    reasons.push(`Requested amount is ${loanToMonthlyIncome.toFixed(1)}x monthly income; policy cap is ${profile.maxLoanToMonthlyIncome}x.`);
  }

  if (riskScore > 78) {
    reasons.push(`BRE risk score ${riskScore} is above the manual-review threshold of 78.`);
  }

  return {
    required: reasons.length > 0,
    reasons,
  };
}

export function buildApplicationDeviation({
  actor,
  reasons,
  requestedAt = new Date().toISOString(),
}: {
  actor: string;
  reasons: string[];
  requestedAt?: string;
}): ApplicationDeviation {
  return {
    id: makeId("dev"),
    reasons,
    requestedAt,
    requestedBy: actor,
    required: true,
    status: "Pending",
  };
}
