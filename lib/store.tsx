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
  DemoSessionUser,
  DEMO_USERS,
  getDemoUserByRole,
  isDemoSessionUser,
  SessionRole,
} from "@/lib/demo-identities";
import { createMockStore } from "@/lib/mock-data";
import {
  AuditLog,
  CollectionName,
  EntityMap,
  MockStore,
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
  login: (role: SessionRole) => void;
  logout: () => void;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);
const STORE_STORAGE_KEY = "cosmos_dsa_store";
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

function initialStore(): MockStore {
  const seededStore = createMockStore();
  if (typeof window === "undefined") return ensureApplicationJourneys(seededStore);

  const stored = localStorage.getItem(STORE_STORAGE_KEY);
  if (!stored) return ensureApplicationJourneys(seededStore);

  try {
    const persistedStore = JSON.parse(stored) as Partial<MockStore>;
    const mergedStore = { ...seededStore, ...persistedStore } as MockStore;
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

    const migratedStore = migrateOnHoldDsaStatuses(migrateLegacyDsaIds(mergedStore));

    console.log("Mock store: loaded from localStorage. Total DSAs in persisted store:", migratedStore.dsas.length);
    return ensureApplicationJourneys(migratedStore);
  } catch (err) {
    console.error("Mock store: failed to parse stored JSON. Resetting to seeded store.", err);
    localStorage.removeItem(STORE_STORAGE_KEY);
    return ensureApplicationJourneys(seededStore);
  }
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

function audit(action: string, collection: CollectionName, actor: string): AuditLog {
  return {
    action,
    actor,
    at: new Date().toISOString(),
    entity: titleCase(collection),
    id: makeId("audit"),
    ipAddress: "10.24.0.91",
    severity: action === "Deleted" ? "Warning" : "Info",
  };
}

export function MockStoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<MockStore>(() => initialStore());
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<DemoSessionUser | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cosmos_dsa_user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (isDemoSessionUser(parsed)) {
            const normalizedUser = getDemoUserByRole(parsed.role);
            localStorage.setItem("cosmos_dsa_user", JSON.stringify(normalizedUser));
            return normalizedUser;
          }
          localStorage.removeItem("cosmos_dsa_user");
          return null;
        } catch {
          localStorage.removeItem("cosmos_dsa_user");
          return null;
        }
      }
    }
    return null;
  });

  useEffect(() => {
    console.log("Mock store: saving to localStorage. Total DSAs:", store.dsas.length);
    localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  const login = useCallback((role: SessionRole) => {
    const user = getDemoUserByRole(role);
    setCurrentUser(user);
    if (typeof window !== "undefined") {
      localStorage.setItem("cosmos_dsa_user", JSON.stringify(user));
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
      localStorage.removeItem("cosmos_dsa_user");
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
      setStore((current) => {
        const actor = currentUser?.name ?? DEMO_USERS.admin.name;
        const next = {
          ...current,
          [collection]: [item, ...current[collection]],
        };
        if (collection !== "auditLogs") {
          next.auditLogs = [audit("Created", collection, actor), ...current.auditLogs];
        }
        console.log(`Mock store: item created in collection "${collection}":`, item);
        return next;
      });
      toast({
        description: `${displayName(item)} was added to ${titleCase(collection)}.`,
        title: "Record created",
        variant: "success",
      });
    },
    [currentUser?.name, toast],
  );

  const updateItem = useCallback(
    <K extends CollectionName>(collection: K, id: string, patch: Partial<EntityMap[K]>) => {
      let updatedName = "record";
      setStore((current) => {
        const actor = currentUser?.name ?? DEMO_USERS.admin.name;
        const nextRows = current[collection].map((item) => {
          if (item.id !== id) return item;
          const updated = { ...item, ...patch };
          updatedName = displayName(updated);
          return updated;
        });
        const next = {
          ...current,
          [collection]: nextRows,
        };
        if (collection !== "auditLogs") {
          next.auditLogs = [audit("Updated", collection, actor), ...current.auditLogs];
        }
        return next;
      });
      toast({
        description: `${updatedName} was updated.`,
        title: "Changes saved",
        variant: "success",
      });
    },
    [currentUser?.name, toast],
  );

  const deleteItem = useCallback(
    <K extends CollectionName>(collection: K, id: string) => {
      let deletedName = "record";
      setStore((current) => {
        const actor = currentUser?.name ?? DEMO_USERS.admin.name;
        const existing = current[collection].find((item) => item.id === id);
        deletedName = displayName(existing);
        const next = {
          ...current,
          [collection]: current[collection].filter((item) => item.id !== id),
        };
        if (collection !== "auditLogs") {
          next.auditLogs = [audit("Deleted", collection, actor), ...current.auditLogs];
        }
        return next;
      });
      toast({
        description: `${deletedName} was removed from ${titleCase(collection)}.`,
        title: "Record deleted",
        variant: "warning",
      });
    },
    [currentUser?.name, toast],
  );

  const deleteDsaCascade = useCallback(
    (id: string) => {
      let deletedName = "record";
      let removedLinkedRecords = 0;
      let found = false;

      setStore((current) => {
        const actor = currentUser?.name ?? DEMO_USERS.admin.name;
        const target = current.dsas.find((item) => item.id === id);
        if (!target) return current;

        found = true;
        deletedName = displayName(target);

        const targetApplications = current.applications.filter((item) => item.dsaId === id);
        const targetApplicationIds = new Set(targetApplications.map((item) => item.id));
        const targetApplicationCodes = new Set(targetApplications.map((item) => item.applicationId));
        const targetUsers = current.users.filter(
          (item) => item.id === id || item.email === target.email || item.name === target.name,
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

        removedLinkedRecords =
          targetApplications.length +
          targetUsers.length +
          targetDocuments.length +
          targetVerificationChecks.length +
          targetApprovals.length +
          targetConfigs.length +
          targetLeads.length +
          targetCommissions.length;

        return {
          ...current,
          applications: current.applications.filter((item) => item.dsaId !== id),
          approvals: current.approvals.filter((item) => !targetApplicationCodes.has(item.applicationId)),
          auditLogs: [audit("Deleted", "dsas", actor), ...current.auditLogs],
          commissions: current.commissions.filter((item) => item.dsaId !== id),
          documents: current.documents.filter(
            (item) => item.dsaId !== id && !targetApplicationIds.has(item.applicationId ?? ""),
          ),
          dsaProductConfigs: current.dsaProductConfigs.filter((item) => item.dsaId !== id),
          dsas: current.dsas.filter((item) => item.id !== id),
          leads: current.leads.filter((item) => item.dsaId !== id),
          users: current.users.filter(
            (item) => item.id !== id && item.email !== target.email && item.name !== target.name,
          ),
          verificationChecks: current.verificationChecks.filter(
            (item) => !targetApplicationCodes.has(item.applicationId),
          ),
        };
      });

      toast({
        description: found
          ? `${deletedName} and ${removedLinkedRecords} linked record${removedLinkedRecords === 1 ? "" : "s"} were removed.`
          : "The selected DSA was not found.",
        title: found ? "DSA permanently deleted" : "DSA not found",
        variant: "warning",
      });
    },
    [currentUser?.name, toast],
  );

  const value = useMemo(
    () => ({ createItem, deleteDsaCascade, deleteItem, getById, store, updateItem, currentUser, login, logout }),
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
