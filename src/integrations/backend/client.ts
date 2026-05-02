import { apiRequest } from "@/api/client";

const TOKEN_KEY = "agency_os_token";

const tableEndpoints: Record<string, string> = {
  clients: "/clients",
  monthly_plans: "/plans",
  deliverables: "/deliverables",
  time_entries: "/attendance",
  notifications: "/notifications",
  profiles: "/team",
  user_roles: "/team",
  client_assets: "/client_assets",
  deliverable_assets: "/deliverable_assets",
};

const getToken = () => localStorage.getItem(TOKEN_KEY);

const normalizeData = (payload: any) => {
  if (Array.isArray(payload)) return payload;
  if (payload?.data !== undefined) return payload.data;
  return payload;
};

class LocalQuery {
  private filters: Record<string, unknown> = {};
  private orderBy: { column: string; ascending?: boolean } | null = null;
  private limitValue: number | null = null;
  private action: "select" | "insert" | "update" | "delete" = "select";
  private body: unknown;

  constructor(private readonly table: string) {}

  select() {
    this.action = "select";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters[column] = value;
    return this;
  }

  not(column: string, _operator: string, value: unknown) {
    this.filters[`not_${column}`] = value;
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters[column] = value;
    return this;
  }

  is(column: string, value: unknown) {
    this.filters[`is_${column}`] = value;
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters[`gte_${column}`] = value;
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters[`lte_${column}`] = value;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending };
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  insert(body: unknown) {
    this.action = "insert";
    this.body = body;
    return this;
  }

  update(body: unknown) {
    this.action = "update";
    this.body = body;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  async maybeSingle() {
    const result = await this.execute();
    const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data ?? null;
    return { data, error: result.error };
  }

  then(resolve: (value: any) => void, reject: (reason?: any) => void) {
    return this.execute().then(resolve, reject);
  }

  private async execute() {
    const token = getToken();
    const baseEndpoint = tableEndpoints[this.table];
    if (!baseEndpoint) {
      return { data: null, error: new Error(`No local API endpoint for ${this.table}`) };
    }

    try {
      const id = typeof this.filters.id === "string" ? `/${this.filters.id}` : "";
      const search = new URLSearchParams();
      Object.entries(this.filters).forEach(([key, value]) => {
        if (key === "id" && id) return;
        if (Array.isArray(value)) search.set(key, value.join(","));
        else if (value === null) search.set(key, "null");
        else if (value !== undefined) search.set(key, String(value));
      });
      if (this.orderBy) search.set("order", `${this.orderBy.column}:${this.orderBy.ascending === false ? "desc" : "asc"}`);
      if (this.limitValue) search.set("limit", String(this.limitValue));

      const path = `${baseEndpoint}${id}${search.toString() ? `?${search.toString()}` : ""}`;

      if (this.action === "insert") {
        const payload = Array.isArray(this.body) ? this.body[0] : this.body;
        return { data: normalizeData(await apiRequest(path, { method: "POST", body: JSON.stringify(payload), token })), error: null };
      }

      if (this.action === "update") {
        const updatePath = this.table === "profiles" ? "/auth/profile" : path;
        return { data: normalizeData(await apiRequest(updatePath, { method: "PATCH", body: JSON.stringify(this.body), token })), error: null };
      }

      if (this.action === "delete") {
        // Asset tables use query params for id, not path segments
        const assetTables = ["deliverable_assets", "client_assets"];
        const deletePath = assetTables.includes(this.table)
          ? `${baseEndpoint}?id=${this.filters.id}`
          : path;
        return { data: normalizeData(await apiRequest(deletePath, { method: "DELETE", token })), error: null };
      }

      return { data: normalizeData(await apiRequest(path, { method: "GET", token })), error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
}

export const backend = {
  get: (path: string) => apiRequest(path, { method: "GET", token: getToken() }),
  post: (path: string, body?: any) => apiRequest(path, { method: "POST", body: body ? JSON.stringify(body) : undefined, token: getToken() }),
  patch: (path: string, body?: any) => apiRequest(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined, token: getToken() }),
  delete: (path: string) => apiRequest(path, { method: "DELETE", token: getToken() }),
  from: (table: string) => new LocalQuery(table),
  rpc: (name: string) => {
    if (name === "get_team_directory") {
      return apiRequest("/team", { method: "GET", token: getToken() })
        .then((payload: any) => ({ data: payload.data ?? [], error: null }))
        .catch((error) => ({ data: null, error }));
    }
    return Promise.resolve({ data: null, error: new Error(`No local RPC endpoint for ${name}`) });
  },
  functions: {
    invoke: (name: string, options?: { body?: any }) => {
      const endpoints: Record<string, { path: string; method: string }> = {
        "get-team-salaries": { path: "/team/salaries", method: "GET" },
        "invite-member": { path: "/team/invite", method: "POST" },
        "remove-member": { path: `/team/${options?.body?.user_id}`, method: "DELETE" },
      };
      const endpoint = endpoints[name];
      if (!endpoint) return Promise.resolve({ data: null, error: new Error(`No local function endpoint for ${name}`) });
      return apiRequest(endpoint.path, {
        method: endpoint.method,
        body: endpoint.method === "POST" ? JSON.stringify(options?.body ?? {}) : undefined,
        token: getToken(),
      })
        .then((data) => ({ data, error: null }))
        .catch((error) => ({ data: null, error }));
    },
  },
  storage: {
    from: (bucket: "client-assets" | "deliverable-assets") => ({
      createSignedUrl: (assetId: string) =>
        apiRequest(`/assets/${bucket}/${assetId}/signed-url`, { method: "GET", token: getToken() })
          .then((data: any) => ({ data: { signedUrl: data.signedUrl }, error: null }))
          .catch((error) => ({ data: null, error })),
      upload: (folder: string, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        return apiRequest(`/assets/${bucket}/${folder}`, { method: "POST", body: formData, token: getToken() })
          .then((data) => ({ data, error: null }))
          .catch((error) => ({ data: null, error }));
      },
    }),
  },
  channel: () => ({
    on: () => ({
      subscribe: () => undefined,
    }),
  }),
  removeChannel: () => undefined,
};
