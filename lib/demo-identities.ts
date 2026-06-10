export type SessionRole = "DSA Manager" | "DSA Partner" | "Customer";
export type DemoUserName = "admin" | "dsa" | "user";

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
  dsa: {
    code: "DSA-0001",
    email: "dsa@cosmosbank.example",
    id: "dsa-1",
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

export const DEMO_USER_NAMES = ["admin", "dsa", "user"] as const;

export function demoActor(index = 0): DemoUserName {
  return DEMO_USER_NAMES[index % DEMO_USER_NAMES.length];
}

export function getDemoUserByRole(role: SessionRole): DemoSessionUser {
  if (role === "DSA Manager") return { ...DEMO_USERS.admin };
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
