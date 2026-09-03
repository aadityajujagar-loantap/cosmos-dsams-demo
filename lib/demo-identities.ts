import seedData from "@/lib/demo-seed-data.json";
import type { Dsa } from "@/lib/types";

export type SessionRole =
  | "DSA Manager"
  | "DSA Credit"
  | "Branch Regional Head"
  | "Branch User"
  | "Assistant Manager"
  | "Manager"
  | "AGM"
  | "DGM"
  | "DSA Partner"
  | "DSA Agent"
  | "Customer";
export type DemoUserName = "admin" | "credit" | "brh" | "branch" | "user";

export interface DemoSessionUser {
  name: string;
  role: SessionRole;
  id: string;
  email: string;
  mobile: string;
  code?: string;
}

const internalUsers = seedData.sessions.internalUsers;
export const HEAD_BANK = seedData.bank;
export const SEED_DSA = seedData.modules.dsa.seedDsas[0];
export const DEFAULT_DSA_ID = SEED_DSA.id;
export const DEFAULT_DSA_LOGIN_USERNAME = SEED_DSA.credentials.loginUsername;
export const DEFAULT_DSA_LOGIN_PASSWORD = SEED_DSA.credentials.loginPassword;

export const DEMO_USERS: Record<DemoUserName, DemoSessionUser> = {
  admin: {
    email: internalUsers.admin.email,
    id: internalUsers.admin.id,
    mobile: internalUsers.admin.mobile,
    name: internalUsers.admin.name,
    role: internalUsers.admin.role as SessionRole,
  },
  credit: {
    email: internalUsers.credit.email,
    id: internalUsers.credit.id,
    mobile: internalUsers.credit.mobile,
    name: internalUsers.credit.name,
    role: internalUsers.credit.role as SessionRole,
  },
  brh: {
    email: internalUsers.brh.email,
    id: internalUsers.brh.id,
    mobile: internalUsers.brh.mobile,
    name: internalUsers.brh.name,
    role: internalUsers.brh.role as SessionRole,
  },
  branch: {
    email: internalUsers.branch.email,
    id: internalUsers.branch.id,
    mobile: internalUsers.branch.mobile,
    name: internalUsers.branch.name,
    role: internalUsers.branch.role as SessionRole,
  },
  user: {
    email: internalUsers.user.email,
    id: internalUsers.user.id,
    mobile: internalUsers.user.mobile,
    name: internalUsers.user.name,
    role: internalUsers.user.role as SessionRole,
  },
};

export const DEFAULT_DSA_SESSION_USER: DemoSessionUser = {
  code: DEFAULT_DSA_ID,
  email: DEFAULT_DSA_LOGIN_USERNAME,
  id: DEFAULT_DSA_ID,
  mobile: SEED_DSA.contact.mobile,
  name: SEED_DSA.name,
  role: "DSA Partner",
};

export const DEMO_USER_NAMES = ["admin", "credit", "brh", "branch", "user"] as const;

const DEMO_PASSWORDS: Record<DemoUserName, string> = {
  admin: internalUsers.admin.password,
  credit: internalUsers.credit.password,
  brh: internalUsers.brh.password,
  branch: internalUsers.branch.password,
  user: internalUsers.user.password,
};

export function demoActor(index = 0): DemoUserName {
  return DEMO_USER_NAMES[index % DEMO_USER_NAMES.length];
}

export function getDemoUserForCredentials(identifier: string, password: string): DemoSessionUser | null {
  const username = identifier.trim().toLowerCase() as DemoUserName;
  if (!DEMO_USER_NAMES.includes(username)) return null;
  if (DEMO_PASSWORDS[username] !== password) return null;
  return { ...DEMO_USERS[username] };
}

export function getDemoRoleForCredentials(identifier: string, password: string): SessionRole | null {
  return getDemoUserForCredentials(identifier, password)?.role ?? null;
}

export function getDemoUserByRole(role: SessionRole): DemoSessionUser {
  if (role === "DSA Manager") return { ...DEMO_USERS.admin };
  if (role === "DSA Credit") return { ...DEMO_USERS.credit };
  if (role === "Branch Regional Head") return { ...DEMO_USERS.brh };
  if (role === "Branch User") return { ...DEMO_USERS.branch };
  if (role === "DSA Partner") return { ...DEFAULT_DSA_SESSION_USER };
  return { ...DEMO_USERS.user };
}

export function sessionUserFromDsa(dsa: {
  id: string | number;
  code: string;
  name: string;
  mobile: string;
  email: string;
  login_username?: string;
  loginUsername?: string;
}): DemoSessionUser {
  return {
    code: dsa.code,
    email: dsa.login_username || dsa.loginUsername || dsa.email,
    id: String(dsa.id),
    mobile: dsa.mobile,
    name: dsa.name,
    role: "DSA Partner",
  };
}

export function isDemoSessionUser(value: unknown): value is DemoSessionUser {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<DemoSessionUser>;
  return (
    typeof record.name === "string" &&
    typeof record.id === "string" &&
    typeof record.email === "string" &&
    typeof record.mobile === "string" &&
    ["DSA Manager", "DSA Credit", "Branch Regional Head", "Branch User", "DSA Partner", "Customer"].includes(record.role ?? "")
  );
}
