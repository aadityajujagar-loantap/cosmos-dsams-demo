export interface Permission {
  id: number;
  name: string;
  description?: string;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
  permissions?: Permission[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  ticket_no: string;
  phone?: string;
  branch_code?: string;
  zone_code?: string;
  deactivated_at?: string;
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
