import { api } from "./client";

export const resourceApi = {
  dashboard: (token: string) => api.get("/dashboard", token),
  clients: (token: string) => api.get("/clients", token),
  plans: (token: string) => api.get("/plans", token),
  deliverables: (token: string) => api.get("/deliverables", token),
  attendance: (token: string) => api.get("/attendance", token),
  notifications: (token: string) => api.get("/notifications", token),
  portal: (token: string) => api.get("/portal", token),
  portalDeliverables: (token: string) => api.get("/portal/deliverables", token),
};
