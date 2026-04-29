import { api } from "./client";

export interface Client {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  brand_color: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  contract_type: string | null;
  onboarded_at: string | null;
  logo_url: string | null;
}

export type ClientPayload = Partial<Omit<Client, "id" | "created_at">> & {
  name?: string;
};

export const clientsApi = {
  list: (token: string) => api.get<{ data: Client[] }>("/clients", token),
  create: (token: string, body: ClientPayload & { name: string }) =>
    api.post<{ data: Client }>("/clients", body, token),
  get: (token: string, id: string) => api.get<{ data: Client & { plans?: any[]; assets?: any[] } }>(`/clients/${id}`, token),
  update: (token: string, id: string, body: ClientPayload) =>
    api.patch<{ data: Client }>(`/clients/${id}`, body, token),
  delete: (token: string, id: string) => api.delete<{ success: true }>(`/clients/${id}`, token),
};
