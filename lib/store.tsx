"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
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
import { makeId, titleCase } from "@/lib/utils";

interface StoreContextValue {
  createItem: <K extends CollectionName>(collection: K, item: EntityMap[K]) => void;
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
  const [store, setStore] = useState<MockStore>(() => createMockStore());
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<DemoSessionUser | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cosmos_dsa_user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (isDemoSessionUser(parsed)) return parsed;
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

  const value = useMemo(
    () => ({ createItem, deleteItem, getById, store, updateItem, currentUser, login, logout }),
    [createItem, deleteItem, getById, store, updateItem, currentUser, login, logout],
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
