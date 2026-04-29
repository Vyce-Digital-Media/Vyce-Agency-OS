import { api } from "./client";

export type AppRole = "admin" | "manager" | "team_member" | "client";

export interface ApiProfile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  internal_label: string | null;
  expected_start_time?: string | null;
  salary_hourly?: number | null;
}

export interface AuthPayload {
  token?: string;
  user: {
    id: string;
    email: string;
  };
  profile: ApiProfile | null;
  role: AppRole | null;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthPayload>("/auth/login", { email, password }),
  me: (token: string) => api.get<AuthPayload>("/auth/me", token),
  logout: (token: string) => api.post<{ success: true }>("/auth/logout", {}, token),
  forgotPassword: (email: string) => api.post<{ success: true }>("/auth/forgot-password", { email }),
  resetPassword: (body: { email: string; token: string; password: string; password_confirmation: string }) =>
    api.post<{ success: true }>("/auth/reset-password", body),
};
