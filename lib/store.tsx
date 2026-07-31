"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ToastProvider, useToast } from "@/components/ui/toast";
import {
  DEFAULT_DSA_ID,
  DEFAULT_DSA_LOGIN_PASSWORD,
  DemoSessionUser,
  DEMO_USERS,
  getDemoUserByRole,
  isDemoSessionUser,
  sessionUserFromDsa,
} from "@/lib/demo-identities";
import { generateDsaCredentials, makeDsaCredentials } from "@/lib/dsa-credentials";
import { createMockStore } from "@/lib/mock-data";
import {
  Application,
  ApprovalItem,
  AuditLog,
  CollectionName,
  DocumentRecord,
  Dsa,
  DsaInvoice,
  DsaInvoiceStatus,
  DsaProductConfig,
  DsaStatus,
  EntityMap,
  MockStore,
  Product,
  User,
  VerificationCheck,
  VerificationStatus,
} from "@/lib/types";
import { journeyPath } from "@/lib/journey-links";
import { makeId, seededDsaId, titleCase } from "@/lib/utils";
import { buildApplicationJourney } from "@/lib/product-journeys";

interface StoreContextValue {
  createItem: <K extends CollectionName>(collection: K, item: EntityMap[K]) => void;
  deleteDsaCascade: (id: string) => void;
  deleteItem: <K extends CollectionName>(collection: K, id: string) => void;
  getById: <K extends CollectionName>(collection: K, id: string) => EntityMap[K] | undefined;
  store: MockStore;
  updateItem: <K extends CollectionName>(
    collection: K,
    id: string,
    patch: Partial<EntityMap[K]>,
  ) => void;
  currentUser: DemoSessionUser | null;
  login: (user: DemoSessionUser) => void;
  logout: () => void;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);
const STORE_STORAGE_KEY = "cosmos_dsa_store";
const STORE_SCHEMA_VERSION_KEY = `${STORE_STORAGE_KEY}_schema_version`;
const STORE_SCHEMA_VERSION = "cosmos-25-dsa-agent-kit-v2";
const USER_STORAGE_KEY = "cosmos_dsa_user";
const COLON_DSA_ID_PATTERN = /^COSDSA(\d{8})(\d{2}):(\d{2}):(\d{2}):(\d{3})$/;
const LEGACY_DSA_ID_PATTERN = /^dsa-(\d+)$/;
const LEGACY_DSA_CODE_PATTERN = /^DSA-\d+$/;

function ensureApplicationJourneys(store: MockStore): MockStore {
  return {
    ...store,
    dsaProductConfigs: store.dsaProductConfigs.map((config) => ({
      ...config,
      loanUrl: journeyPath(config.id),
    })),
    applications: store.applications.map((application, index) =>
      application.journey
        ? application
        : {
            ...application,
            journey: buildApplicationJourney(application.product, index, application),
          },
    ),
  };
}

function legacyDsaIdToSeededId(id: string) {
  const match = LEGACY_DSA_ID_PATTERN.exec(id);
  if (!match) return id;

  const index = Number(match[1]) - 1;
  if (!Number.isInteger(index) || index < 0) return id;
  return seededDsaId(index);
}

function normalizeDsaId(id: string) {
  const colonMatch = COLON_DSA_ID_PATTERN.exec(id);
  if (colonMatch) {
    return `COSDSA${colonMatch.slice(1).join("")}`;
  }

  return legacyDsaIdToSeededId(id);
}

function shouldReplaceLegacyDsaCode(code: string, oldId: string) {
  return code === oldId || normalizeDsaId(code) !== code || LEGACY_DSA_CODE_PATTERN.test(code);
}

function migrateLegacyDsaIds(store: MockStore): MockStore {
  const idMap = new Map<string, string>();

  store.dsas.forEach((dsa) => {
    const nextId = normalizeDsaId(dsa.id);
    if (nextId !== dsa.id) idMap.set(dsa.id, nextId);
  });

  const mapDsaId = (id: string) => idMap.get(id) ?? normalizeDsaId(id);

  return {
    ...store,
    applications: store.applications.map((application) => ({
      ...application,
      dsaId: mapDsaId(application.dsaId),
    })),
    commissions: store.commissions.map((commission) => ({
      ...commission,
      dsaId: mapDsaId(commission.dsaId),
    })),
    documents: store.documents.map((document) => ({
      ...document,
      dsaId: document.dsaId ? mapDsaId(document.dsaId) : document.dsaId,
    })),
    dsaProductConfigs: store.dsaProductConfigs.map((config) => {
      const dsaId = mapDsaId(config.dsaId);
      return {
        ...config,
        dsaCode: shouldReplaceLegacyDsaCode(config.dsaCode, config.dsaId) ? dsaId : config.dsaCode,
        dsaId,
      };
    }),
    dsaInvoices: (store.dsaInvoices ?? []).map((invoice) => ({
      ...invoice,
      dsaId: mapDsaId(invoice.dsaId),
    })),
    dsas: store.dsas.map((dsa) => {
      const id = mapDsaId(dsa.id);
      return {
        ...dsa,
        code: shouldReplaceLegacyDsaCode(dsa.code, dsa.id) ? id : dsa.code,
        documents: dsa.documents.map((document) => ({
          ...document,
          dsaId: document.dsaId ? mapDsaId(document.dsaId) : document.dsaId,
        })),
        id,
      };
    }),
    leads: store.leads.map((lead) => ({
      ...lead,
      dsaId: mapDsaId(lead.dsaId),
    })),
  };
}

function hasMissingDsaDocumentPlaceholder(dsa: MockStore["dsas"][number]) {
  return dsa.documents.some(
    (document) => document.size === "0 KB" || document.remarks.includes("Mandatory document missing"),
  );
}

function migrateOnHoldDsaStatuses(store: MockStore): MockStore {
  return {
    ...store,
    dsas: store.dsas.map((dsa) =>
      hasMissingDsaDocumentPlaceholder(dsa)
        ? {
            ...dsa,
            status: "On Hold",
          }
        : dsa,
    ),
  };
}

function ensureDsaCredentials(dsa: Dsa, fallbackBranchNumber = 1): Dsa {
  const fallbackCredentials = makeDsaCredentials(fallbackBranchNumber);
  const loginUsername = (dsa.loginUsername || dsa.email).trim().toLowerCase();
  const fallbackPassword =
    dsa.id === DEFAULT_DSA_ID ? DEFAULT_DSA_LOGIN_PASSWORD : fallbackCredentials.loginPassword;
  const loginPassword = (dsa.loginPassword || fallbackPassword).trim() || fallbackPassword;

  return {
    ...dsa,
    loginPassword,
    loginUsername,
  };
}

function dsaAccountUserStatus(status: DsaStatus): User["status"] {
  if (status === "Active") return "Active";
  if (status === "Suspended" || status === "Rejected" || status === "Blacklisted") return "Disabled";
  return "Invited";
}

function isDsaPartnerUserForDsa(user: User, dsa: Dsa, previous?: Dsa) {
  if (user.role !== "DSA Partner") return false;
  const userEmail = user.email.trim().toLowerCase();
  return (
    user.id === dsa.id ||
    user.dsaId === dsa.id ||
    userEmail === dsa.loginUsername.trim().toLowerCase() ||
    userEmail === dsa.email.trim().toLowerCase() ||
    Boolean(
      previous &&
        (user.id === previous.id ||
          user.dsaId === previous.id ||
          userEmail === previous.loginUsername.trim().toLowerCase() ||
          userEmail === previous.email.trim().toLowerCase()),
    )
  );
}

function dsaPartnerUserFromDsa(dsa: Dsa, existing?: User): User {
  return {
    dsaId: dsa.id,
    email: dsa.loginUsername,
    id: dsa.id,
    lastLogin: existing?.lastLogin ?? dsa.onboardingDate,
    name: dsa.name,
    region: dsa.manager || dsa.city || dsa.state,
    role: "DSA Partner",
    status: dsaAccountUserStatus(dsa.status),
  };
}

const DEFAULT_DSA_PRODUCTS: Product[] = [
  "Personal Loan",
  "Home Loan",
  "Loan Against Property",
  "Business Loan",
  "Auto Loan",
];

const agentFirstNames = [
  "Aarav",
  "Nisha",
  "Rohan",
  "Meera",
  "Kabir",
  "Anika",
  "Dev",
  "Riya",
  "Ishaan",
  "Saanvi",
  "Karthik",
  "Divya",
  "Arjun",
  "Neha",
  "Vikram",
  "Prisha",
  "Raghav",
  "Simran",
  "Harsh",
  "Hetal",
];

const agentLastNames = [
  "Sharma",
  "Patel",
  "Rao",
  "Iyer",
  "Mehta",
  "Nair",
  "Kapoor",
  "Shah",
  "Kulkarni",
  "Reddy",
  "Singh",
  "Banerjee",
  "Joshi",
  "Gill",
  "Jain",
  "Verma",
];

function stableNumber(value: string) {
  return value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function dsaAgentTargetCount(dsa: Pick<Dsa, "id">) {
  return 15 + (stableNumber(dsa.id) % 6);
}

function dsaAgentStatus(status: DsaStatus): User["status"] {
  if (status === "Active") return "Active";
  if (status === "Suspended" || status === "Rejected" || status === "Blacklisted") return "Disabled";
  return "Invited";
}

function dsaAgentUserFromDsa(dsa: Dsa, index: number, existing?: User): User {
  const firstName = agentFirstNames[(stableNumber(dsa.id) + index) % agentFirstNames.length];
  const lastName = agentLastNames[(stableNumber(dsa.code) + index * 2) % agentLastNames.length];
  const safeCode = slug(dsa.code || dsa.id);

  return {
    dsaId: dsa.id,
    email: existing?.email ?? `agent${index + 1}.${safeCode}@cosdsa.in`,
    id: existing?.id ?? `usr-agent-${safeCode}-${String(index + 1).padStart(2, "0")}`,
    lastLogin: existing?.lastLogin ?? dsa.onboardingDate,
    name: existing?.name ?? `${firstName} ${lastName}`,
    region: existing?.region ?? (dsa.city || dsa.name),
    role: "DSA Agent",
    status: existing?.status ?? dsaAgentStatus(dsa.status),
  };
}

function defaultDsaProductConfig(dsa: Dsa, product: Product, index: number): DsaProductConfig {
  const id = `config-${slug(dsa.id)}-${slug(product)}`;

  return {
    bannerName: `${dsa.city || dsa.name} ${product} Campaign`,
    commissionType: index % 3 === 0 ? "Percentage-based" : index % 3 === 1 ? "Tiered" : "Fixed-fee",
    configuredAt: dsa.onboardingDate,
    configuredBy: DEMO_USERS.admin.name,
    dsaCode: dsa.code,
    dsaId: dsa.id,
    dsaName: dsa.name,
    id,
    loanUrl: journeyPath(id),
    product,
    ranges: [
      {
        effectiveDate: "2026-04-01",
        endDate: "2027-03-31",
        frequency: "Monthly",
        id: `${id}-r1`,
        max: 2500000,
        min: 0,
        rate: 0.75 + index * 0.15,
      },
      {
        effectiveDate: "2026-04-01",
        endDate: "2027-03-31",
        frequency: "Monthly",
        growthRequired: true,
        id: `${id}-r2`,
        max: 10000000,
        min: 2500001,
        rate: 1.1 + index * 0.2,
      },
    ],
    status: dsa.status === "Blacklisted" ? "Inactive" : "Active",
  };
}

function hydratePersistedStore(persistedStore: Partial<MockStore>, seededStore = createMockStore()): MockStore {
  const mergedStore = { ...seededStore, ...persistedStore } as MockStore;
  mergedStore.applications = mergedStore.applications ?? [];
  mergedStore.roles = mergedStore.roles ?? [];
  mergedStore.users = mergedStore.users ?? [];

  const existingApplicationIds = new Set(mergedStore.applications.map((item) => item.id));
  const seededProductDemoApplications = seededStore.applications.filter((item) =>
    item.id.startsWith("app-product-demo-"),
  );
  const existingUserIds = new Set(mergedStore.users.map((item) => item.id));
  const existingRoleIds = new Set(mergedStore.roles.map((item) => item.id));

  mergedStore.applications = [
    ...mergedStore.applications,
    ...seededProductDemoApplications.filter((item) => !existingApplicationIds.has(item.id)),
  ];
  mergedStore.users = [
    ...mergedStore.users,
    ...seededStore.users.filter((item) => !existingUserIds.has(item.id)),
  ];
  mergedStore.roles = [
    ...mergedStore.roles,
    ...seededStore.roles.filter((item) => !existingRoleIds.has(item.id)),
  ];

  return ensureStoreRelationships(ensureApplicationJourneys(migrateOnHoldDsaStatuses(migrateLegacyDsaIds(mergedStore))));
}

function initialStore(): MockStore {
  const seededStore = createMockStore();
  if (typeof window === "undefined") return ensureStoreRelationships(ensureApplicationJourneys(seededStore));

  const storedVersion = localStorage.getItem(STORE_SCHEMA_VERSION_KEY);
  if (storedVersion !== STORE_SCHEMA_VERSION) {
    localStorage.removeItem(STORE_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.setItem(STORE_SCHEMA_VERSION_KEY, STORE_SCHEMA_VERSION);
    return ensureStoreRelationships(ensureApplicationJourneys(seededStore));
  }

  const stored = localStorage.getItem(STORE_STORAGE_KEY);
  if (!stored) return ensureStoreRelationships(ensureApplicationJourneys(seededStore));

  try {
    const persistedStore = JSON.parse(stored) as Partial<MockStore>;
    const hydratedStore = hydratePersistedStore(persistedStore, seededStore);

    console.log("Mock store: loaded from localStorage. Total DSAs in persisted store:", hydratedStore.dsas.length);
    return hydratedStore;
  } catch (err) {
    console.error("Mock store: failed to parse stored JSON. Resetting to seeded store.", err);
    localStorage.removeItem(STORE_STORAGE_KEY);
    return ensureStoreRelationships(ensureApplicationJourneys(seededStore));
  }
}

function persistStoreSnapshot(nextStore: MockStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_SCHEMA_VERSION_KEY, STORE_SCHEMA_VERSION);
  localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify(nextStore));
}

function displayName(item: unknown): string {
  if (!item || typeof item !== "object") return "record";
  const record = item as Record<string, unknown>;
  return String(
    record.name ??
      record.customer ??
      record.ruleName ??
      record.title ??
      record.payoutId ??
      record.workflowId ??
      record.documentId ??
      record.checkId ??
      record.role ??
      record.label ??
      record.id ??
      "record",
  );
}

type StoreEntity = EntityMap[CollectionName];

function asRecord(item: unknown): Record<string, unknown> {
  return item && typeof item === "object" ? (item as Record<string, unknown>) : {};
}

function auditValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "string") return value.length > 90 ? `${value.slice(0, 87)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  return "object";
}

function changedFieldNames(previous: unknown, next: unknown) {
  const before = asRecord(previous);
  const after = asRecord(next);
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  return keys
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .filter((key) => !["id"].includes(key))
    .slice(0, 12);
}

function findAuditDsa(store: MockStore, collection: CollectionName, item: unknown) {
  const record = asRecord(item);

  if (collection === "dsas") {
    return {
      affectedDsaId: String(record.id ?? ""),
      affectedDsaName: String(record.name ?? ""),
    };
  }

  const directDsaId = typeof record.dsaId === "string" ? record.dsaId : "";
  if (directDsaId) {
    const dsa = store.dsas.find((row) => row.id === directDsaId);
    return {
      affectedDsaId: directDsaId,
      affectedDsaName: dsa?.name ?? String(record.dsaName ?? ""),
    };
  }

  const applicationRef = typeof record.applicationId === "string" ? record.applicationId : "";
  if (applicationRef) {
    const application = findApplicationByReference(store, applicationRef);
    if (application) {
      return {
        affectedDsaId: application.dsaId,
        affectedDsaName: application.dsaName,
      };
    }
  }

  return {
    affectedDsaId: "",
    affectedDsaName: "",
  };
}

function auditActionType(baseAction: string, collection: CollectionName, previous: unknown, next: unknown) {
  const before = asRecord(previous);
  const after = asRecord(next);

  if (baseAction === "Created") {
    if (collection === "documents") return "Upload";
    if (collection === "dsaInvoices") return "Invoice Raised";
    return "Create";
  }
  if (baseAction === "Deleted") return "Delete";
  if (collection === "approvals" && before.status !== after.status) {
    if (after.status === "Approved") return "Approval";
    if (after.status === "Rejected") return "Rejection";
    return "Workflow";
  }
  if (collection === "dsas" && before.status !== after.status) {
    if (after.status === "Active") return "DSA Approval";
    if (after.status === "Rejected") return "DSA Rejection";
    if (after.status === "Suspended" || after.status === "Blacklisted") return "DSA Lifecycle";
    return "Hierarchy Workflow";
  }
  if (collection === "applications" && before.status !== after.status) {
    if (after.status === "Approved") return "Application Approval";
    if (after.status === "Rejected") return "Application Rejection";
    if (after.status === "Disbursed") return "Disbursal";
    return "Application Workflow";
  }
  if (collection === "documents" && before.status !== after.status) return "Document Review";
  if (collection === "dsaInvoices" && before.status !== after.status) return "Invoice Workflow";
  if (collection === "dsaProductConfigs") return "Product Configuration";
  if (["loginUsername", "loginPassword"].some((field) => before[field] !== after[field])) return "Credential Change";

  return "Update";
}

function auditSummary(baseAction: string, collection: CollectionName, item: unknown, previous: unknown, actionType: string) {
  const changed = changedFieldNames(previous, item);
  const name = displayName(item);
  if (baseAction === "Created") return `${name} was created in ${titleCase(collection)}.`;
  if (baseAction === "Deleted") return `${name} was deleted from ${titleCase(collection)}.`;
  if (changed.length === 0) return `${name} was updated in ${titleCase(collection)}.`;
  return `${actionType}: ${name} changed ${changed.join(", ")}.`;
}

function audit(
  action: string,
  collection: CollectionName,
  actorUser: DemoSessionUser | null,
  item?: unknown,
  previous?: unknown,
  store?: MockStore,
): AuditLog {
  const actor = actorUser?.name ?? DEMO_USERS.admin.name;
  const actorRole = actorUser?.role ?? DEMO_USERS.admin.role;
  const target = item ?? { id: actorUser?.id, name: actor, role: actorRole };
  const record = asRecord(target);
  const changedFields = action === "Updated" ? changedFieldNames(previous, target) : [];
  const actionType = auditActionType(action, collection, previous, target);
  const dsaScope = store
    ? findAuditDsa(store, collection, target)
    : {
        affectedDsaId: "",
        affectedDsaName: "",
      };
  const severity =
    action === "Deleted" ||
    actionType.includes("Rejection") ||
    actionType.includes("Lifecycle") ||
    record.status === "Rejected" ||
    record.status === "Blacklisted"
      ? "Warning"
      : "Info";

  return {
    action: actionType,
    actionType,
    actor,
    actorId: actorUser?.id,
    actorRole,
    at: new Date().toISOString(),
    affectedDsaId: dsaScope.affectedDsaId || undefined,
    affectedDsaName: dsaScope.affectedDsaName || undefined,
    affectedRole:
      typeof record.role === "string"
        ? record.role
        : typeof record.approvedByRole === "string"
          ? record.approvedByRole
          : undefined,
    changedFields,
    collection,
    entity: titleCase(collection),
    entityId: String(record.id ?? record.applicationId ?? record.workflowId ?? record.documentId ?? ""),
    entityName: displayName(target),
    fromValue: changedFields.map((key) => `${key}: ${auditValue(asRecord(previous)[key])}`).join(" | ") || undefined,
    id: makeId("audit"),
    ipAddress: "10.24.0.91",
    severity,
    summary: auditSummary(action, collection, target, previous, actionType),
    toValue: changedFields.map((key) => `${key}: ${auditValue(record[key])}`).join(" | ") || undefined,
  };
}

const REQUIRED_APPLICATION_CHECKS: VerificationCheck["type"][] = ["KYC", "Address", "Employment", "Bank"];
const DSA_LINKED_COLLECTIONS: CollectionName[] = [
  "applications",
  "commissions",
  "documents",
  "dsaInvoices",
  "dsaProductConfigs",
  "dsaRecovery",
  "leads",
];
const DSA_BLOCKING_STATUSES: DsaStatus[] = ["Suspended", "Rejected", "Blacklisted"];
const CLOSED_APPLICATION_STATUSES: Application["status"][] = ["Approved", "Rejected", "Disbursed"];
const DSA_LIFECYCLE_HOLD_PREFIX = "DSA lifecycle hold:";
const DSA_INVOICE_STATUSES: DsaInvoiceStatus[] = [
  "Raised by DSA",
  "Countered by Bank",
  "Countered by DSA",
  "Pending Approval",
  "Approved",
  "Rejected",
];

function isDsaLinkedCollection(collection: CollectionName) {
  return DSA_LINKED_COLLECTIONS.includes(collection);
}

function isBlockingDsaStatus(status: DsaStatus) {
  return DSA_BLOCKING_STATUSES.includes(status);
}

function isClosedApplicationStatus(status: Application["status"]) {
  return CLOSED_APPLICATION_STATUSES.includes(status);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  const base = Number.isNaN(date.getTime()) ? new Date() : date;
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

function event(actor: string, title: string, note: string, at = new Date().toISOString()) {
  return {
    actor,
    at,
    id: makeId("tl"),
    note,
    title,
  };
}

function prependNote(notes: string[], note: string) {
  return notes[0] === note ? notes : [note, ...notes.filter((item) => item !== note)];
}

function prependTimeline(application: Application, actor: string, title: string, note: string, at?: string) {
  const first = application.timeline[0];
  if (first?.title === title && first.note === note) return application.timeline;
  return [event(actor, title, note, at), ...application.timeline];
}

function carryDisplayName(value: string, previousName: string | undefined, nextName: string) {
  return !value || (previousName && value === previousName) ? nextName : value;
}

function findApplicationByReference(store: MockStore, reference?: string | null) {
  if (!reference) return undefined;
  return store.applications.find(
    (application) => application.id === reference || application.applicationId === reference,
  );
}

function normalizeDsaInvoice(invoice: DsaInvoice): DsaInvoice {
  const grossAmount = Number(invoice.grossAmount ?? 0);
  const adjustmentAmount = Number(invoice.adjustmentAmount ?? 0);
  const taxAmount = Number(invoice.taxAmount ?? 0);
  const netAmount = Number(invoice.netAmount ?? Math.max(0, grossAmount + taxAmount - adjustmentAmount));
  const requestedAmount = Number(invoice.requestedAmount ?? netAmount);
  const status = DSA_INVOICE_STATUSES.includes(invoice.status) ? invoice.status : "Raised by DSA";

  return {
    ...invoice,
    adjustmentAmount,
    grossAmount,
    history: Array.isArray(invoice.history) ? invoice.history : [],
    netAmount,
    requestedAmount,
    source: invoice.source ?? "Manual",
    status,
    taxAmount,
    updatedAt: invoice.updatedAt || invoice.createdAt || new Date().toISOString(),
  };
}

function normalizeLinkedEntity<K extends CollectionName>(
  store: MockStore,
  collection: K,
  item: EntityMap[K],
): { item: EntityMap[K]; blockedReason?: string } {
  const next = { ...(item as unknown as Record<string, unknown>) };

  if (collection === "dsas") {
    const fallbackCredentials = generateDsaCredentials(
      store.dsas.filter((dsa) => dsa.id !== String(next.id ?? "")),
    );
    next.loginUsername =
      String(next.loginUsername ?? "").trim().toLowerCase() || fallbackCredentials.loginUsername;
    next.loginPassword = String(next.loginPassword ?? "").trim() || fallbackCredentials.loginPassword;
  }

  if (collection === "dsaInvoices") {
    const status = String(next.status ?? "");
    next.status = DSA_INVOICE_STATUSES.includes(status as DsaInvoiceStatus) ? status : "Raised by DSA";
    next.source = next.source === "CSV Upload" ? "CSV Upload" : "Manual";
    next.grossAmount = Number(next.grossAmount ?? 0);
    next.adjustmentAmount = Number(next.adjustmentAmount ?? 0);
    next.taxAmount = Number(next.taxAmount ?? 0);
    next.netAmount = Number(
      next.netAmount ?? Math.max(0, Number(next.grossAmount) + Number(next.taxAmount) - Number(next.adjustmentAmount)),
    );
    next.requestedAmount = Number(next.requestedAmount ?? next.netAmount);
    next.updatedAt = String(next.updatedAt ?? next.createdAt ?? new Date().toISOString());
    if (!Array.isArray(next.history)) next.history = [];
  }

  if ("dsaId" in next && typeof next.dsaId === "string" && next.dsaId.trim()) {
    const dsa = store.dsas.find((row) => row.id === next.dsaId);
    if (!dsa && isDsaLinkedCollection(collection)) {
      return {
        blockedReason: `Cannot save ${titleCase(collection)} because linked DSA ${next.dsaId} was not found.`,
        item,
      };
    }
    if (dsa) {
      if ("dsaName" in next) next.dsaName = dsa.name;
      if ("dsaCode" in next) next.dsaCode = dsa.code;
    }
  }

  if (collection === "verificationChecks" || collection === "approvals") {
    const application = findApplicationByReference(store, String(next.applicationId ?? ""));
    if (!application) {
      return {
        blockedReason: `Cannot save ${titleCase(collection)} because linked application ${String(next.applicationId ?? "")} was not found.`,
        item,
      };
    }
    next.applicationId = application.applicationId;
    if ("customer" in next) next.customer = application.customer;
  }

  if (collection === "documents") {
    const applicationRef = typeof next.applicationId === "string" ? next.applicationId : "";
    if (applicationRef.trim()) {
      const application = findApplicationByReference(store, applicationRef);
      if (!application) {
        return {
          blockedReason: `Cannot save document because linked application ${applicationRef} was not found.`,
          item,
        };
      }
      next.applicationId = application.id;
      if (!next.ownerName) next.ownerName = application.customer;
    }
  }

  return { item: next as unknown as EntityMap[K] };
}

function ensureDsaAgents(store: MockStore, dsa: Dsa): MockStore {
  const existingAgents = store.users.filter((user) => user.role === "DSA Agent" && user.dsaId === dsa.id);
  const targetCount = dsaAgentTargetCount(dsa);
  if (existingAgents.length >= targetCount) return store;

  const existingAgentIds = new Set(existingAgents.map((user) => user.id));
  const missingAgents = Array.from({ length: targetCount - existingAgents.length }, (_, offset) => {
    const agentIndex = existingAgents.length + offset;
    let agent = dsaAgentUserFromDsa(dsa, agentIndex);

    while (store.users.some((user) => user.id === agent.id) || existingAgentIds.has(agent.id)) {
      agent = { ...agent, id: makeId("usr-agent") };
    }

    existingAgentIds.add(agent.id);
    return agent;
  });

  return {
    ...store,
    users: [...store.users, ...missingAgents],
  };
}

function ensureDsaProductConfigs(store: MockStore, dsa: Dsa): MockStore {
  const existingConfigs = store.dsaProductConfigs.filter((config) => config.dsaId === dsa.id);
  const syncedConfigs = store.dsaProductConfigs.map((config) =>
    config.dsaId === dsa.id
      ? {
          ...config,
          dsaCode: dsa.code,
          dsaName: dsa.name,
          loanUrl: journeyPath(config.id),
        }
      : config,
  );

  if (existingConfigs.length > 0) {
    return {
      ...store,
      dsaProductConfigs: syncedConfigs,
    };
  }

  return {
    ...store,
    dsaProductConfigs: [
      ...syncedConfigs,
      ...DEFAULT_DSA_PRODUCTS.map((product, index) => defaultDsaProductConfig(dsa, product, index)),
    ],
  };
}

function ensureDsaStarterRecords(store: MockStore, dsa: Dsa): MockStore {
  return ensureDsaProductConfigs(ensureDsaAgents(store, dsa), dsa);
}

function syncDsaRecordReferences(
  store: MockStore,
  previous: Dsa | undefined,
  dsa: Dsa,
  ensureStarterRecords = false,
): MockStore {
  const syncedDsa = ensureDsaCredentials(dsa);
  const existingPartnerUser = store.users.find((user) => isDsaPartnerUserForDsa(user, syncedDsa, previous));
  const partnerUser = dsaPartnerUserFromDsa(syncedDsa, existingPartnerUser);
  const shouldSyncAgentStatus = previous ? previous.status !== syncedDsa.status : false;
  const nextAgentStatus = dsaAgentStatus(syncedDsa.status);

  const referencedStore = {
    ...store,
    applications: store.applications.map((application) =>
      application.dsaId === syncedDsa.id ? { ...application, dsaName: syncedDsa.name } : application,
    ),
    commissions: store.commissions.map((commission) =>
      commission.dsaId === syncedDsa.id ? { ...commission, dsaName: syncedDsa.name } : commission,
    ),
    documents: store.documents.map((document) =>
      document.dsaId === syncedDsa.id
        ? { ...document, ownerName: carryDisplayName(document.ownerName, previous?.name, syncedDsa.name) }
        : document,
    ),
    dsaProductConfigs: store.dsaProductConfigs.map((config) =>
      config.dsaId === syncedDsa.id ? { ...config, dsaCode: syncedDsa.code, dsaName: syncedDsa.name } : config,
    ),
    dsaRecovery: store.dsaRecovery.map((recovery) =>
      recovery.dsaId === syncedDsa.id ? { ...recovery, dsaName: syncedDsa.name } : recovery,
    ),
    dsaInvoices: store.dsaInvoices.map((invoice) =>
      invoice.dsaId === syncedDsa.id
        ? { ...invoice, dsaCode: syncedDsa.code, dsaName: syncedDsa.name }
        : invoice,
    ),
    dsas: store.dsas.map((row) =>
      row.id === syncedDsa.id
        ? {
            ...syncedDsa,
            documents: row.documents.map((document) => ({
              ...document,
              dsaId: syncedDsa.id,
              ownerName: carryDisplayName(document.ownerName, previous?.name, syncedDsa.name),
            })),
          }
        : row,
    ),
    leads: store.leads.map((lead) => (lead.dsaId === syncedDsa.id ? { ...lead, dsaName: syncedDsa.name } : lead)),
    users: [
      partnerUser,
      ...store.users
        .filter((user) => !isDsaPartnerUserForDsa(user, syncedDsa, previous))
        .map((user) =>
          user.role === "DSA Agent" && (user.dsaId === syncedDsa.id || user.dsaId === previous?.id)
            ? {
                ...user,
                dsaId: syncedDsa.id,
                region: carryDisplayName(user.region, previous?.city || previous?.name, syncedDsa.city || syncedDsa.name),
                status: shouldSyncAgentStatus ? nextAgentStatus : user.status,
              }
            : user,
        ),
    ],
  };

  return ensureStarterRecords ? ensureDsaStarterRecords(referencedStore, syncedDsa) : referencedStore;
}

function syncApplicationReferences(
  store: MockStore,
  previous: Application | undefined,
  application: Application,
): MockStore {
  const references = new Set(
    [application.id, application.applicationId, previous?.id, previous?.applicationId].filter(Boolean) as string[],
  );

  return {
    ...store,
    approvals: store.approvals.map((approval) =>
      references.has(approval.applicationId)
        ? { ...approval, applicationId: application.applicationId, customer: application.customer }
        : approval,
    ),
    documents: store.documents.map((document) =>
      document.applicationId && references.has(document.applicationId)
        ? {
            ...document,
            applicationId: application.id,
            ownerName: carryDisplayName(document.ownerName, previous?.customer, application.customer),
          }
        : document,
    ),
    verificationChecks: store.verificationChecks.map((check) =>
      references.has(check.applicationId)
        ? { ...check, applicationId: application.applicationId, customer: application.customer }
        : check,
    ),
  };
}

function defaultVerificationCheck(
  application: Application,
  type: VerificationCheck["type"],
  index: number,
  actor: string,
): VerificationCheck {
  const numericId = application.applicationId.replace(/\D/g, "").slice(-5).padStart(5, "0");
  return {
    applicationId: application.applicationId,
    assignedTo: actor,
    checkId: `VER-${numericId}-${index + 1}`,
    customer: application.customer,
    dueDate: addDays(application.createdAt, index + 2),
    evidence: "Pending source validation",
    id: `ver-auto-${application.id}-${slug(type)}`,
    status: "Pending",
    type,
  };
}

function defaultApprovalWorkflow(application: Application, actor: string): ApprovalItem {
  const numericId = application.applicationId.replace(/\D/g, "").slice(-5).padStart(5, "0");
  const stage: ApprovalItem["stage"] = application.deviation?.required ? "Risk Review" : "Maker";
  return {
    applicationId: application.applicationId,
    approver: actor,
    customer: application.customer,
    history: [
      {
        actor,
        at: application.createdAt,
        id: `tl-auto-${application.id}-approval`,
        note: `Workflow opened for ${application.applicationId}.`,
        title: "Workflow initiated",
      },
    ],
    id: `approval-auto-${application.id}`,
    stage,
    status: "Pending",
    updatedAt: application.createdAt,
    workflowId: `WF-${numericId}`,
  };
}

function ensureApplicationChildren(store: MockStore, application: Application, actor: string): MockStore {
  const existingChecks = store.verificationChecks.filter((check) => check.applicationId === application.applicationId);
  const existingTypes = new Set(existingChecks.map((check) => check.type));
  const missingChecks = REQUIRED_APPLICATION_CHECKS
    .filter((type) => !existingTypes.has(type))
    .map((type, index) => defaultVerificationCheck(application, type, existingTypes.size + index, actor));
  const hasApproval = store.approvals.some((approval) => approval.applicationId === application.applicationId);

  return {
    ...store,
    approvals: hasApproval ? store.approvals : [defaultApprovalWorkflow(application, actor), ...store.approvals],
    verificationChecks: missingChecks.length
      ? [...missingChecks, ...store.verificationChecks]
      : store.verificationChecks,
  };
}

function deriveVerificationStatus(statuses: VerificationStatus[], fallback: VerificationStatus): VerificationStatus {
  if (statuses.length === 0) return fallback;
  if (statuses.includes("Failed")) return "Failed";
  if (statuses.every((status) => status === "Verified")) return "Verified";
  if (statuses.includes("In Progress")) return "In Progress";
  return "Pending";
}

function syncApplicationVerification(
  store: MockStore,
  applicationRef: string | undefined,
  actor: string,
  addTimeline = true,
): MockStore {
  const application = findApplicationByReference(store, applicationRef);
  if (!application) return store;

  const statuses = [
    ...store.documents
      .filter((document) => document.applicationId === application.id || document.applicationId === application.applicationId)
      .map((document) => document.status),
    ...store.verificationChecks
      .filter((check) => check.applicationId === application.applicationId || check.applicationId === application.id)
      .map((check) => check.status),
  ];
  const verificationStatus = deriveVerificationStatus(statuses, application.verificationStatus);

  return {
    ...store,
    applications: store.applications.map((row) => {
      if (row.id !== application.id) return row;

      let next: Application = { ...row, verificationStatus };
      if (verificationStatus === "Failed" && row.status !== "Disbursed") {
        const note = `Verification failed for ${row.applicationId}. Application held for operations review.`;
        next = {
          ...next,
          decisionSummary: note,
          notes: prependNote(row.notes, note),
          stage: "Risk Review",
          status: "On Hold",
          timeline: addTimeline ? prependTimeline(row, actor, "Verification failed", note) : row.timeline,
        };
      } else if (
        verificationStatus === "Verified" &&
        !isClosedApplicationStatus(row.status) &&
        row.deviation?.status !== "Pending"
      ) {
        const note = `Verification completed for ${row.applicationId}. Application moved to underwriting.`;
        next = {
          ...next,
          decisionSummary: row.decisionSummary,
          notes: addTimeline && row.verificationStatus !== verificationStatus ? prependNote(row.notes, note) : row.notes,
          stage: row.stage === "Lead Capture" || row.stage === "Document Review" ? "Credit Underwriting" : row.stage,
          status: row.status === "Draft" || row.status === "On Hold" ? "In Review" : row.status,
          timeline:
            addTimeline && row.verificationStatus !== verificationStatus
              ? prependTimeline(row, actor, "Verification completed", note)
              : row.timeline,
        };
      } else if (verificationStatus === "In Progress" && row.status === "Draft") {
        next = { ...next, stage: "Document Review", status: "In Review" };
      }

      return next;
    }),
  };
}

function applicationStageFromApproval(stage: ApprovalItem["stage"]): Application["stage"] {
  switch (stage) {
    case "Maker":
    case "Checker":
      return "Document Review";
    case "Risk Review":
      return "Risk Review";
    case "Final Approval":
      return "Approval";
  }
}

function syncApprovalToApplication(
  store: MockStore,
  approval: ApprovalItem,
  actor: string,
  addTimeline = true,
): MockStore {
  const application = findApplicationByReference(store, approval.applicationId);
  if (!application) return store;

  return {
    ...store,
    applications: store.applications.map((row) => {
      if (row.id !== application.id || row.status === "Disbursed") return row;

      const nextStage = applicationStageFromApproval(approval.stage);
      const note = `${approval.workflowId} is ${approval.status.toLowerCase()} at ${approval.stage}.`;
      let next: Application = row;

      if (approval.status === "Rejected") {
        next = { ...row, decisionSummary: note, stage: "Risk Review", status: "Rejected" };
      } else if (approval.status === "Returned") {
        next = { ...row, decisionSummary: note, stage: nextStage, status: "On Hold" };
      } else if (approval.status === "Approved") {
        next = { ...row, decisionSummary: note, stage: "Approval", status: "Approved" };
      } else if (row.deviation?.status === "Pending") {
        next = { ...row, stage: "Risk Review", status: "On Hold" };
      } else {
        next = {
          ...row,
          stage: nextStage,
          status: row.status === "Draft" || row.status === "On Hold" ? "In Review" : row.status,
        };
      }

      const changed = next.status !== row.status || next.stage !== row.stage || next.decisionSummary !== row.decisionSummary;
      if (!addTimeline || !changed) return next;

      return {
        ...next,
        notes: prependNote(next.notes, note),
        timeline: prependTimeline(row, actor, "Approval workflow updated", note, approval.updatedAt),
      };
    }),
  };
}

function syncApprovalQueueAfterDelete(store: MockStore, applicationRef: string, actor: string): MockStore {
  const application = findApplicationByReference(store, applicationRef);
  if (!application) return store;

  const latestApproval = store.approvals
    .filter((approval) => approval.applicationId === application.applicationId)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0];

  return latestApproval ? syncApprovalToApplication(store, latestApproval, actor) : store;
}

function syncLeadConversion(store: MockStore, application: Application): MockStore {
  return {
    ...store,
    leads: store.leads.map((lead) =>
      lead.dsaId === application.dsaId &&
      lead.customer === application.customer &&
      lead.product === application.product &&
      lead.status !== "Converted" &&
      lead.status !== "Lost"
        ? {
            ...lead,
            nextAction: `Application ${application.applicationId} created. Track the application workflow.`,
            status: "Converted",
          }
        : lead,
    ),
  };
}

function syncDsaLifecycle(store: MockStore, previousStatus: DsaStatus, dsa: Dsa, actor: string): MockStore {
  if (isBlockingDsaStatus(dsa.status)) {
    const applicationNote = `${DSA_LIFECYCLE_HOLD_PREFIX} ${dsa.name} is ${dsa.status}. Application held for reassignment or compliance review.`;
    const leadAction = `${DSA_LIFECYCLE_HOLD_PREFIX} ${dsa.name} is ${dsa.status}. Reassign or wait for reactivation.`;

    return {
      ...store,
      applications: store.applications.map((application) =>
        application.dsaId === dsa.id && !isClosedApplicationStatus(application.status)
          ? {
              ...application,
              decisionSummary: applicationNote,
              notes: prependNote(application.notes, applicationNote),
              stage: "Risk Review",
              status: "On Hold",
              timeline: prependTimeline(application, actor, "DSA lifecycle hold", applicationNote),
            }
          : application,
      ),
      commissions: store.commissions.map((commission) =>
        commission.dsaId === dsa.id && commission.status === "Pending"
          ? { ...commission, status: "Hold" }
          : commission,
      ),
      leads: store.leads.map((lead) =>
        lead.dsaId === dsa.id && lead.status !== "Converted" && lead.status !== "Lost"
          ? { ...lead, nextAction: leadAction, status: "In Progress" }
          : lead,
      ),
    };
  }

  if (dsa.status === "Active" && isBlockingDsaStatus(previousStatus)) {
    const resumeNote = `DSA lifecycle resumed: ${dsa.name} is Active. Application reopened for normal processing.`;

    return {
      ...store,
      applications: store.applications.map((application) =>
        application.dsaId === dsa.id &&
        application.status === "On Hold" &&
        (application.decisionSummary.startsWith(DSA_LIFECYCLE_HOLD_PREFIX) ||
          application.notes.some((note) => note.startsWith(DSA_LIFECYCLE_HOLD_PREFIX))) &&
        application.deviation?.status !== "Pending" &&
        application.verificationStatus !== "Failed"
          ? {
              ...application,
              decisionSummary: resumeNote,
              notes: prependNote(application.notes, resumeNote),
              stage: "Credit Underwriting",
              status: "In Review",
              timeline: prependTimeline(application, actor, "DSA lifecycle resumed", resumeNote),
            }
          : application,
      ),
      leads: store.leads.map((lead) =>
        lead.dsaId === dsa.id && lead.nextAction.startsWith(DSA_LIFECYCLE_HOLD_PREFIX)
          ? { ...lead, nextAction: "DSA reactivated. Resume customer follow-up or reassign if needed." }
          : lead,
      ),
    };
  }

  return store;
}

function syncDsaAfterWrite(store: MockStore, previous: Dsa | undefined, dsa: Dsa, actor: string): MockStore {
  let next = syncDsaRecordReferences(store, previous, dsa, !previous);
  if (previous && previous.status !== dsa.status) {
    next = syncDsaLifecycle(next, previous.status, dsa, actor);
  }
  return next;
}

function syncApplicationAfterWrite(
  store: MockStore,
  previous: Application | undefined,
  application: Application,
  actor: string,
  mode: "create" | "update",
): MockStore {
  let next = syncApplicationReferences(store, previous, application);
  if (mode === "create") {
    next = ensureApplicationChildren(next, application, actor);
    next = syncLeadConversion(next, application);
  }
  return next;
}

function syncAfterWrite(
  store: MockStore,
  collection: CollectionName,
  previous: StoreEntity | undefined,
  item: StoreEntity,
  actor: string,
  mode: "create" | "update",
): MockStore {
  switch (collection) {
    case "applications":
      return syncApplicationAfterWrite(store, previous as Application | undefined, item as Application, actor, mode);
    case "approvals":
      return syncApprovalToApplication(store, item as ApprovalItem, actor, mode === "update");
    case "documents": {
      const document = item as DocumentRecord;
      return syncApplicationVerification(store, document.applicationId, actor);
    }
    case "dsas":
      return syncDsaAfterWrite(store, previous as Dsa | undefined, item as Dsa, actor);
    case "verificationChecks": {
      const check = item as VerificationCheck;
      return syncApplicationVerification(store, check.applicationId, actor);
    }
    default:
      return store;
  }
}

function syncAfterDelete(store: MockStore, collection: CollectionName, deleted: StoreEntity, actor: string): MockStore {
  switch (collection) {
    case "applications": {
      const application = deleted as Application;
      return {
        ...store,
        approvals: store.approvals.filter((approval) => approval.applicationId !== application.applicationId),
        documents: store.documents.filter(
          (document) => document.applicationId !== application.id && document.applicationId !== application.applicationId,
        ),
        verificationChecks: store.verificationChecks.filter(
          (check) => check.applicationId !== application.applicationId && check.applicationId !== application.id,
        ),
      };
    }
    case "approvals": {
      const approval = deleted as ApprovalItem;
      return syncApprovalQueueAfterDelete(store, approval.applicationId, actor);
    }
    case "documents": {
      const document = deleted as DocumentRecord;
      return syncApplicationVerification(store, document.applicationId, actor);
    }
    case "verificationChecks": {
      const check = deleted as VerificationCheck;
      return syncApplicationVerification(store, check.applicationId, actor);
    }
    default:
      return store;
  }
}

function ensureStoreRelationships(store: MockStore): MockStore {
  let next = {
    ...store,
    dsaInvoices: (store.dsaInvoices ?? []).map(normalizeDsaInvoice),
    dsas: store.dsas.map((dsa, index) => ensureDsaCredentials(dsa, index + 1)),
  };

  next.dsas.forEach((dsa) => {
    next = syncDsaRecordReferences(next, undefined, dsa, true);
  });

  next.applications.forEach((application) => {
    const currentApplication = findApplicationByReference(next, application.id);
    if (!currentApplication) return;
    next = syncApplicationReferences(next, undefined, currentApplication);
    next = ensureApplicationChildren(next, currentApplication, DEMO_USERS.admin.name);
  });

  return next;
}

export function MockStoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<MockStore>(() => initialStore());
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<DemoSessionUser | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (isDemoSessionUser(parsed)) {
            let sessionUser: DemoSessionUser | null = null;

            if (parsed.role === "DSA Partner") {
              const dsa = store.dsas.find(
                (row) =>
                  row.status === "Active" &&
                  (row.id === parsed.id ||
                    row.code === parsed.code ||
                    row.loginUsername.toLowerCase() === parsed.email.toLowerCase()),
              );
              sessionUser = dsa ? sessionUserFromDsa(dsa) : null;
            } else {
              sessionUser = getDemoUserByRole(parsed.role);
            }

            if (!sessionUser) {
              localStorage.removeItem(USER_STORAGE_KEY);
              return null;
            }

            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(sessionUser));
            return sessionUser;
          }
          localStorage.removeItem(USER_STORAGE_KEY);
          return null;
        } catch {
          localStorage.removeItem(USER_STORAGE_KEY);
          return null;
        }
      }
    }
    return null;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const serializedStore = JSON.stringify(store);
    if (localStorage.getItem(STORE_STORAGE_KEY) !== serializedStore) {
      console.log("Mock store: saving to localStorage. Total DSAs:", store.dsas.length);
      localStorage.setItem(STORE_SCHEMA_VERSION_KEY, STORE_SCHEMA_VERSION);
      localStorage.setItem(STORE_STORAGE_KEY, serializedStore);
    }
  }, [store]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function syncStoreFromStorage() {
      const stored = localStorage.getItem(STORE_STORAGE_KEY);
      if (!stored) return;

      setStore((current) => {
        if (JSON.stringify(current) === stored) return current;

        try {
          const hydratedStore = hydratePersistedStore(JSON.parse(stored) as Partial<MockStore>);
          return JSON.stringify(current) === JSON.stringify(hydratedStore) ? current : hydratedStore;
        } catch (err) {
          console.warn("Mock store: failed to sync external store update.", err);
          return current;
        }
      });
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === STORE_STORAGE_KEY) syncStoreFromStorage();
    }

    window.addEventListener("focus", syncStoreFromStorage);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("focus", syncStoreFromStorage);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const login = useCallback((user: DemoSessionUser) => {
    setCurrentUser(user);
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
    toast({
      description: `Logged in as ${user.name} (${user.role})`,
      title: "Authentication successful",
      variant: "success",
    });
  }, [toast]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
    toast({
      description: "You have been logged out.",
      title: "Logged out",
      variant: "warning",
    });
  }, [toast]);

  const getById = useCallback(
    <K extends CollectionName>(collection: K, id: string) =>
      store[collection].find((item) => item.id === id) as EntityMap[K] | undefined,
    [store],
  );

  const createItem = useCallback(
    <K extends CollectionName>(collection: K, item: EntityMap[K]) => {
      let blockedReason = "";
      let createdItem = item;

      setStore((current) => {
        const actor = currentUser?.name ?? DEMO_USERS.admin.name;
        const normalized = normalizeLinkedEntity(current, collection, item);
        if (normalized.blockedReason) {
          blockedReason = normalized.blockedReason;
          return current;
        }

        createdItem = normalized.item;
        let next = {
          ...current,
          [collection]: [normalized.item, ...current[collection]],
        } as MockStore;
        if (collection !== "auditLogs") {
          next.auditLogs = [audit("Created", collection, currentUser, normalized.item, undefined, current), ...current.auditLogs];
        }
        next = syncAfterWrite(next, collection, undefined, normalized.item as StoreEntity, actor, "create");
        persistStoreSnapshot(next);
        console.log(`Mock store: item created in collection "${collection}":`, normalized.item);
        return next;
      });

      if (blockedReason) {
        toast({
          description: blockedReason,
          title: "Record not saved",
          variant: "warning",
        });
        return;
      }

      toast({
        description: `${displayName(createdItem)} was added to ${titleCase(collection)}.`,
        title: "Record created",
        variant: "success",
      });
    },
    [currentUser, toast],
  );

  const updateItem = useCallback(
    <K extends CollectionName>(collection: K, id: string, patch: Partial<EntityMap[K]>) => {
      let blockedReason = "";
      let updatedName = "record";

      setStore((current) => {
        const actor = currentUser?.name ?? DEMO_USERS.admin.name;
        const existing = current[collection].find((item) => item.id === id) as EntityMap[K] | undefined;
        if (!existing) {
          blockedReason = `Cannot update ${titleCase(collection)} because record ${id} was not found.`;
          return current;
        }

        const candidate = { ...existing, ...patch } as EntityMap[K];
        const normalized = normalizeLinkedEntity(current, collection, candidate);
        if (normalized.blockedReason) {
          blockedReason = normalized.blockedReason;
          return current;
        }

        updatedName = displayName(normalized.item);
        const nextRows = current[collection].map((item) => (item.id === id ? normalized.item : item));
        const next = {
          ...current,
          [collection]: nextRows,
        } as MockStore;
        if (collection !== "auditLogs") {
          next.auditLogs = [audit("Updated", collection, currentUser, normalized.item, existing, current), ...current.auditLogs];
        }
        const synced = syncAfterWrite(next, collection, existing as StoreEntity, normalized.item as StoreEntity, actor, "update");
        persistStoreSnapshot(synced);
        return synced;
      });

      if (blockedReason) {
        toast({
          description: blockedReason,
          title: "Changes not saved",
          variant: "warning",
        });
        return;
      }

      toast({
        description: `${updatedName} was updated.`,
        title: "Changes saved",
        variant: "success",
      });
    },
    [currentUser, toast],
  );

  const deleteItem = useCallback(
    <K extends CollectionName>(collection: K, id: string) => {
      let blockedReason = "";
      let deletedName = "record";

      setStore((current) => {
        const actor = currentUser?.name ?? DEMO_USERS.admin.name;
        const existing = current[collection].find((item) => item.id === id) as EntityMap[K] | undefined;
        if (!existing) {
          blockedReason = `Cannot delete ${titleCase(collection)} because record ${id} was not found.`;
          return current;
        }

        deletedName = displayName(existing);
        const next = {
          ...current,
          [collection]: current[collection].filter((item) => item.id !== id),
        } as MockStore;
        if (collection !== "auditLogs") {
          next.auditLogs = [audit("Deleted", collection, currentUser, existing, existing, current), ...current.auditLogs];
        }
        const synced = syncAfterDelete(next, collection, existing as StoreEntity, actor);
        persistStoreSnapshot(synced);
        return synced;
      });

      if (blockedReason) {
        toast({
          description: blockedReason,
          title: "Record not deleted",
          variant: "warning",
        });
        return;
      }

      toast({
        description: `${deletedName} was removed from ${titleCase(collection)}.`,
        title: "Record deleted",
        variant: "warning",
      });
    },
    [currentUser, toast],
  );

  const deleteDsaCascade = useCallback(
    (id: string) => {
      let deletedName = "record";
      let removedLinkedRecords = 0;
      let found = false;

      setStore((current) => {
        const target = current.dsas.find((item) => item.id === id);
        if (!target) return current;

        found = true;
        deletedName = displayName(target);

        const targetApplications = current.applications.filter((item) => item.dsaId === id);
        const targetApplicationIds = new Set(targetApplications.map((item) => item.id));
        const targetApplicationCodes = new Set(targetApplications.map((item) => item.applicationId));
        const targetUsers = current.users.filter(
          (item) => item.id === id || item.dsaId === id || item.email === target.email || item.name === target.name,
        );
        const targetDocuments = current.documents.filter(
          (item) => item.dsaId === id || targetApplicationIds.has(item.applicationId ?? ""),
        );
        const targetVerificationChecks = current.verificationChecks.filter((item) =>
          targetApplicationCodes.has(item.applicationId),
        );
        const targetApprovals = current.approvals.filter((item) => targetApplicationCodes.has(item.applicationId));
        const targetConfigs = current.dsaProductConfigs.filter((item) => item.dsaId === id);
        const targetLeads = current.leads.filter((item) => item.dsaId === id);
        const targetCommissions = current.commissions.filter((item) => item.dsaId === id);
        const targetInvoices = current.dsaInvoices.filter((item) => item.dsaId === id);

        removedLinkedRecords =
          targetApplications.length +
          targetUsers.length +
          targetDocuments.length +
          targetVerificationChecks.length +
          targetApprovals.length +
          targetConfigs.length +
          targetLeads.length +
          targetCommissions.length +
          targetInvoices.length;

        const next = {
          ...current,
          applications: current.applications.filter((item) => item.dsaId !== id),
          approvals: current.approvals.filter((item) => !targetApplicationCodes.has(item.applicationId)),
          auditLogs: [audit("Deleted", "dsas", currentUser, target, target, current), ...current.auditLogs],
          commissions: current.commissions.filter((item) => item.dsaId !== id),
          documents: current.documents.filter(
            (item) => item.dsaId !== id && !targetApplicationIds.has(item.applicationId ?? ""),
          ),
          dsaInvoices: current.dsaInvoices.filter((item) => item.dsaId !== id),
          dsaProductConfigs: current.dsaProductConfigs.filter((item) => item.dsaId !== id),
          dsas: current.dsas.filter((item) => item.id !== id),
          leads: current.leads.filter((item) => item.dsaId !== id),
          users: current.users.filter(
            (item) => item.id !== id && item.dsaId !== id && item.email !== target.email && item.name !== target.name,
          ),
          verificationChecks: current.verificationChecks.filter(
            (item) => !targetApplicationCodes.has(item.applicationId),
          ),
        };
        persistStoreSnapshot(next);
        return next;
      });

      toast({
        description: found
          ? `${deletedName} and ${removedLinkedRecords} linked record${removedLinkedRecords === 1 ? "" : "s"} were removed.`
          : "The selected DSA was not found.",
        title: found ? "DSA permanently deleted" : "DSA not found",
        variant: "warning",
      });
    },
    [currentUser, toast],
  );

  const value = useMemo(
    () => ({
      createItem,
      deleteDsaCascade,
      deleteItem,
      getById,
      store,
      updateItem,
      currentUser,
      login,
      logout,
    }),
    [createItem, deleteDsaCascade, deleteItem, getById, store, updateItem, currentUser, login, logout],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useMockStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useMockStore must be used inside MockStoreProvider");
  }
  return context;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <MockStoreProvider>{children}</MockStoreProvider>
    </ToastProvider>
  );
}
