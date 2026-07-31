import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "shared_store.json");
const LEGACY_STORE_FILE = path.join(process.cwd(), "temp", "shared_store.json");

type StoreSnapshot = Record<string, unknown>;
type InvoiceSnapshot = Record<string, unknown> & {
  id?: string;
  invoiceNumber?: string;
  updatedAt?: string;
  createdAt?: string;
  history?: unknown[];
};

function noStoreJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...init?.headers,
    },
  });
}

function readJsonFile(filePath: string) {
  if (!fs.existsSync(filePath)) return null;

  const data = fs.readFileSync(filePath, "utf-8");
  if (!data.trim()) return null;

  return JSON.parse(data);
}

function readStoreSnapshot(): StoreSnapshot | null {
  return (readJsonFile(STORE_FILE) ?? readJsonFile(LEGACY_STORE_FILE)) as StoreSnapshot | null;
}

function writeStoreSnapshot(snapshot: StoreSnapshot) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  fs.writeFileSync(STORE_FILE, JSON.stringify(snapshot, null, 2), "utf-8");
}

function invoiceKey(invoice: InvoiceSnapshot) {
  return String(invoice.id || invoice.invoiceNumber || "");
}

function invoiceTimestamp(invoice: InvoiceSnapshot) {
  const value = String(invoice.updatedAt || invoice.createdAt || "");
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function preferInvoice(left: InvoiceSnapshot, right: InvoiceSnapshot) {
  const leftTime = invoiceTimestamp(left);
  const rightTime = invoiceTimestamp(right);
  if (leftTime !== rightTime) return leftTime > rightTime ? left : right;

  const leftHistory = Array.isArray(left.history) ? left.history.length : 0;
  const rightHistory = Array.isArray(right.history) ? right.history.length : 0;
  return leftHistory >= rightHistory ? left : right;
}

function mergeInvoices(existing: unknown, incoming: unknown) {
  const byKey = new Map<string, InvoiceSnapshot>();

  [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])].forEach((invoice) => {
    if (!invoice || typeof invoice !== "object") return;

    const row = invoice as InvoiceSnapshot;
    const key = invoiceKey(row);
    if (!key) return;

    const current = byKey.get(key);
    byKey.set(key, current ? preferInvoice(current, row) : row);
  });

  return Array.from(byKey.values()).sort((left, right) => invoiceTimestamp(right) - invoiceTimestamp(left));
}

function mergeStoreSnapshots(existing: StoreSnapshot | null, incoming: StoreSnapshot) {
  if (!existing) return incoming;

  return {
    ...existing,
    ...incoming,
    dsaInvoices: mergeInvoices(existing.dsaInvoices, incoming.dsaInvoices),
  };
}

export async function GET() {
  try {
    const snapshot = readStoreSnapshot();
    if (snapshot && !fs.existsSync(STORE_FILE)) {
      writeStoreSnapshot(snapshot);
    }

    return noStoreJson(snapshot);
  } catch (error) {
    console.error("Failed to read store file", error);
    return noStoreJson(null);
  }
}

export async function POST(request: Request) {
  try {
    const incomingStore = (await request.json()) as StoreSnapshot;
    const mergedStore = mergeStoreSnapshots(readStoreSnapshot(), incomingStore);
    writeStoreSnapshot(mergedStore);

    return noStoreJson({ success: true });
  } catch (error) {
    console.error("Failed to write store file", error);
    return noStoreJson({ error: "Failed to write file" }, { status: 500 });
  }
}
