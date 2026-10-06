export interface MasterValueItem {
  id?: number;
  meta_key?: string;
  meta_value?: string;
  key?: string;
  value?: string;
  name?: string;
  label?: string;
}

/**
 * Safely extract display string from any master value item representation
 */
function getItemValue(item: any): string {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  return (item.meta_value || item.value || item.name || item.label || '').trim();
}

/**
 * Safely extract key prefix from any master value item representation
 */
function getItemKey(item: any): string {
  if (!item || typeof item === 'string') return '';
  return (item.meta_key || item.key || '').trim().toUpperCase();
}

/**
 * Dynamically filter Loan Purpose values fetched directly from backend API
 * (/api/master-values/dropdown?call_type=loan_purpose).
 *
 * Values are strictly loaded from database (LoanPurposeSeeder).
 */
export function getLoanPurposeOptionsFromApi(
  apiPurposes?: any[],
  productName?: string,
  loanTypeName?: string
): string[] {
  const combined = `${productName || ''} ${loanTypeName || ''}`.toLowerCase().trim();

  // Normalize API purposes list
  const validApiItems = Array.isArray(apiPurposes) ? apiPurposes.filter(Boolean) : [];

  if (validApiItems.length === 0) {
    return [];
  }

  const matchedPrefixes: string[] = [];

  if (combined.includes('resale') && combined.includes('home')) {
    matchedPrefixes.push('HOME_LOAN_RESALE', 'HOME_LOAN');
  } else if (combined.includes('construction') && combined.includes('home')) {
    matchedPrefixes.push('HOME_LOAN_CONSTRUCTION', 'HOME_LOAN');
  } else if (combined.includes('takeover') && combined.includes('home')) {
    matchedPrefixes.push('HOME_LOAN_TAKEOVER', 'HOME_LOAN');
  } else if (combined.includes('home') || combined.includes('housing')) {
    matchedPrefixes.push('HOME_LOAN_NEW', 'HOME_LOAN_RESALE', 'HOME_LOAN_CONSTRUCTION', 'HOME_LOAN_TAKEOVER', 'HOME_LOAN', 'COSMO_TOPUP');
  } else if (combined.includes('cosmo topup') || combined.includes('delight') || (combined.includes('top-up') && combined.includes('home'))) {
    matchedPrefixes.push('COSMO_TOPUP', 'HOME_LOAN');
  } else if (combined.includes('mortgage') || combined.includes('lap') || combined.includes('property')) {
    matchedPrefixes.push('MORTGAGE');
  } else if (combined.includes('education')) {
    matchedPrefixes.push('EDUCATION');
  } else if (combined.includes('personal')) {
    matchedPrefixes.push('PERSONAL');
  } else if (combined.includes('two wheeler') || combined.includes('2 wheeler') || combined.includes('bike')) {
    matchedPrefixes.push('TWO_WHEELER', 'VEHICLE');
  } else if (combined.includes('resale') && combined.includes('car')) {
    matchedPrefixes.push('RESALE_CAR', 'VEHICLE');
  } else if (combined.includes('commercial vehicle') || combined.includes('comm. vehicle') || combined.includes('cv')) {
    matchedPrefixes.push('COMMERCIAL_VEHICLE', 'VEHICLE');
  } else if (combined.includes('car') || combined.includes('four wheeler') || combined.includes('auto')) {
    matchedPrefixes.push('NEW_CAR', 'RESALE_CAR', 'VEHICLE');
  } else if (combined.includes('durable') || combined.includes('solar')) {
    matchedPrefixes.push('CONSUMER_DURABLE');
  } else if (
    combined.includes('business') ||
    combined.includes('pharmaceutical') ||
    combined.includes('doctor') ||
    combined.includes('udyog') ||
    combined.includes('cash credit') ||
    combined.includes('credit') ||
    combined.includes('machinery') ||
    combined.includes('equipment') ||
    combined.includes('furniture')
  ) {
    matchedPrefixes.push('MORTGAGE', 'PERSONAL');
  }

  // 1. Try prefix-matching against API purposes if available
  if (matchedPrefixes.length > 0) {
    const filtered = validApiItems.filter((item) => {
      const key = getItemKey(item);
      const val = getItemValue(item);
      if (!val) return false;
      if (!key) return true; // If key missing, include item
      return matchedPrefixes.some((prefix) => key.startsWith(prefix));
    });

    if (filtered.length > 0) {
      const results = Array.from(new Set(filtered.map(getItemValue))).filter(Boolean);
      if (results.length > 0) return results;
    }
  }

  // 2. Return all unique non-empty purpose values from API
  return Array.from(new Set(validApiItems.map(getItemValue))).filter(Boolean);
}

