import type { DsaProductConfig } from "@/lib/types";

export function journeyPath(configId: string) {
  return `/journey/${configId}`;
}

export function journeyUrl(configId: string) {
  const path = journeyPath(configId);
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function configJourneyUrl(config: DsaProductConfig) {
  if (config.loanUrl?.startsWith("http") && config.loanUrl.includes(journeyPath(config.id))) {
    return config.loanUrl;
  }
  return journeyUrl(config.id);
}
