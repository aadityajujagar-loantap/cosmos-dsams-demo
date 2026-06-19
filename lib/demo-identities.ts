import { seededDsaId } from "@/lib/utils";

export type SessionRole = "DSA Manager" | "DSA Credit" | "Branch User" | "DSA Partner" | "Customer";
export type DemoUserName = "admin" | "credit" | "branch" | "dsa" | "user";

export interface DemoSessionUser {
  name: DemoUserName;
  role: SessionRole;
  id: string;
  email: string;
  mobile: string;
  code?: string;
}

export const DEMO_USERS = {
  admin: {
    email: "admin@cosmosbank.example",
    id: "admin",
    mobile: "9999999999",
    name: "admin",
    role: "DSA Manager",
  },
  credit: {
    email: "credit@cosmosbank.example",
    id: "credit",
    mobile: "9999999998",
    name: "credit",
    role: "DSA Credit",
  },
  branch: {
    email: "branch@cosmosbank.example",
    id: "branch",
    mobile: "9999999997",
    name: "branch",
    role: "Branch User",
  },
  dsa: {
    code: seededDsaId(0),
    email: "dsa@cosmosbank.example",
    id: seededDsaId(0),
    mobile: "8888888888",
    name: "dsa",
    role: "DSA Partner",
  },
  user: {
    email: "user@example.com",
    id: "user",
    mobile: "7777777777",
    name: "user",
    role: "Customer",
  },
} satisfies Record<DemoUserName, DemoSessionUser>;

export const DEMO_USER_NAMES = ["admin", "credit", "branch", "dsa", "user"] as const;

const DEMO_PASSWORDS: Record<DemoUserName, string> = {
  admin: "admin@123",
  credit: "credit@123",
  branch: "branch@123",
  dsa: "dsa@123",
  user: "user@123",
};

export function demoActor(index = 0): DemoUserName {
  return DEMO_USER_NAMES[index % DEMO_USER_NAMES.length];
}

export function getDemoRoleForCredentials(identifier: string, password: string): SessionRole | null {
  const username = identifier.trim().toLowerCase() as DemoUserName;
  if (!DEMO_USER_NAMES.includes(username)) return null;
  if (DEMO_PASSWORDS[username] !== password) return null;
  return DEMO_USERS[username].role;
}

export function getDemoUserByRole(role: SessionRole): DemoSessionUser {
  if (role === "DSA Manager") return { ...DEMO_USERS.admin };
  if (role === "DSA Credit") return { ...DEMO_USERS.credit };
  if (role === "Branch User") return { ...DEMO_USERS.branch };
  if (role === "DSA Partner") return { ...DEMO_USERS.dsa };
  return { ...DEMO_USERS.user };
}

export function isDemoSessionUser(value: unknown): value is DemoSessionUser {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<DemoSessionUser>;
  return DEMO_USER_NAMES.some((name) => {
    const demoUser = DEMO_USERS[name];
    return record.name === demoUser.name && record.role === demoUser.role;
  });
}
