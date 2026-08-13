export interface Permission {
  id: number;
  name: string;
  description?: string | null;
}

export interface Role {
  id: number;
  name: string;
  description?: string | null;
  permissions?: Permission[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  ticket_no?: string | null;
  phone?: string | null;
  branch_role_id?: string | null;
  branch_code?: string | null;
  zone_code?: string | null;
  deactivated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  roles?: Role[];
}

export interface RolesPermissionsData {
  roles: Role[];
}

export interface AuthSession {
  token: string;
  user: User;
  roles: {
    id: number;
    name: string;
    permissions: {
      id: number;
      name: string;
    }[];
  }[];
}
