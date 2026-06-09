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

function audit(action: string, collection: CollectionName): AuditLog {
  return {
    action,
    actor: "Aditi Rao",
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

  const getById = useCallback(
    <K extends CollectionName>(collection: K, id: string) =>
      store[collection].find((item) => item.id === id) as EntityMap[K] | undefined,
    [store],
  );

  const createItem = useCallback(
    <K extends CollectionName>(collection: K, item: EntityMap[K]) => {
      setStore((current) => {
        const next = {
          ...current,
          [collection]: [item, ...current[collection]],
        };
        if (collection !== "auditLogs") {
          next.auditLogs = [audit("Created", collection), ...current.auditLogs];
        }
        return next;
      });
      toast({
        description: `${displayName(item)} was added to ${titleCase(collection)}.`,
        title: "Record created",
        variant: "success",
      });
    },
    [toast],
  );

  const updateItem = useCallback(
    <K extends CollectionName>(collection: K, id: string, patch: Partial<EntityMap[K]>) => {
      let updatedName = "record";
      setStore((current) => {
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
          next.auditLogs = [audit("Updated", collection), ...current.auditLogs];
        }
        return next;
      });
      toast({
        description: `${updatedName} was updated.`,
        title: "Changes saved",
        variant: "success",
      });
    },
    [toast],
  );

  const deleteItem = useCallback(
    <K extends CollectionName>(collection: K, id: string) => {
      let deletedName = "record";
      setStore((current) => {
        const existing = current[collection].find((item) => item.id === id);
        deletedName = displayName(existing);
        const next = {
          ...current,
          [collection]: current[collection].filter((item) => item.id !== id),
        };
        if (collection !== "auditLogs") {
          next.auditLogs = [audit("Deleted", collection), ...current.auditLogs];
        }
        return next;
      });
      toast({
        description: `${deletedName} was removed from ${titleCase(collection)}.`,
        title: "Record deleted",
        variant: "warning",
      });
    },
    [toast],
  );

  const value = useMemo(
    () => ({ createItem, deleteItem, getById, store, updateItem }),
    [createItem, deleteItem, getById, store, updateItem],
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
