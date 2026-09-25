export interface MasterValueItem {
  id?: number;
  meta_key: string;
  meta_value: string;
}

/**
 * Dynamically filter Loan Purpose values fetched directly from backend API
 * (/api/master-values/dropdown?call_type=loan_purpose).
 *
 * NO HARDCODED VALUES: All purpose strings are sourced from the backend API response.
 */
export function getLoanPurposeOptionsFromApi(
  apiPurposes: MasterValueItem[],
  productName?: string,
  loanTypeName?: string
): string[] {
  if (!Array.isArray(apiPurposes) || apiPurposes.length === 0) {
    return [];
  }

  const combined = `${productName || ""} ${loanTypeName || ""}`.toLowerCase().trim();

  if (!combined) {
    return Array.from(new Set(apiPurposes.map((item) => item.meta_value))).filter(Boolean);
  }

  const matchedPrefixes: string[] = [];

  if (combined.includes("resale") && combined.includes("home")) {
    matchedPrefixes.push("HOME_LOAN_RESALE");
  } else if (combined.includes("construction") && combined.includes("home")) {
    matchedPrefixes.push("HOME_LOAN_CONSTRUCTION");
  } else if (combined.includes("takeover") && combined.includes("home")) {
    matchedPrefixes.push("HOME_LOAN_TAKEOVER");
  } else if (combined.includes("home loan")) {
    matchedPrefixes.push("HOME_LOAN_NEW", "HOME_LOAN_RESALE", "HOME_LOAN_CONSTRUCTION", "HOME_LOAN_TAKEOVER");
  } else if (combined.includes("cosmo") || combined.includes("delight") || (combined.includes("top-up") && combined.includes("home"))) {
    matchedPrefixes.push("COSMO_TOPUP");
  } else if (combined.includes("mortgage") || combined.includes("lap") || combined.includes("property")) {
    matchedPrefixes.push("MORTGAGE");
  } else if (combined.includes("education")) {
    matchedPrefixes.push("EDUCATION");
  } else if (combined.includes("personal")) {
    matchedPrefixes.push("PERSONAL");
  } else if (combined.includes("two wheeler") || combined.includes("2 wheeler") || combined.includes("bike")) {
    matchedPrefixes.push("TWO_WHEELER");
  } else if (combined.includes("resale") && combined.includes("car")) {
    matchedPrefixes.push("RESALE_CAR");
  } else if (combined.includes("car") || combined.includes("four wheeler")) {
    matchedPrefixes.push("NEW_CAR");
  } else if (combined.includes("commercial") || combined.includes("cv")) {
    matchedPrefixes.push("COMMERCIAL_VEHICLE");
  } else if (combined.includes("durable") || combined.includes("solar")) {
    matchedPrefixes.push("CONSUMER_DURABLE");
  }

  if (matchedPrefixes.length > 0) {
    const filtered = apiPurposes.filter((item) =>
      matchedPrefixes.some((prefix) => item.meta_key && item.meta_key.startsWith(prefix))
    );
    if (filtered.length > 0) {
      return Array.from(new Set(filtered.map((item) => item.meta_value))).filter(Boolean);
    }
  }

  // Fallback: Return all values fetched from backend API
  return Array.from(new Set(apiPurposes.map((item) => item.meta_value))).filter(Boolean);
}
