import { api } from "./client";
import type { AppRole, ApiProfile } from "./auth";

export interface TeamMember extends ApiProfile {
  email: string;
  role: AppRole;
}

export const teamApi = {
  list: (token: string) => api.get<{ data: TeamMember[] }>("/team", token),
  invite: (token: string, body: { email: string; full_name: string; role: AppRole }) =>
    api.post<{ success: true; user_id: string; email: string }>("/team/invite", body, token),
  remove: (token: string, userId: string) => api.delete<{ success: true }>(`/team/${userId}`, token),
  updateRole: (token: string, userId: string, role: AppRole) =>
    api.patch<{ success: true }>(`/team/${userId}/role`, { role }, token),
  updateProfile: (token: string, userId: string, body: Partial<Pick<ApiProfile, "full_name" | "internal_label" | "expected_start_time" | "salary_hourly">>) =>
    api.patch<{ success: true }>(`/team/${userId}/profile`, body, token),
};
