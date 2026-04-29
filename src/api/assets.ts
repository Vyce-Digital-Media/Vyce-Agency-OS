import { api } from "./client";

export const assetsApi = {
  signedUrl: (token: string, bucket: "client-assets" | "deliverable-assets", assetId: string) =>
    api.get<{ signedUrl: string }>(`/assets/${bucket}/${assetId}/signed-url`, token),
  delete: (token: string, bucket: "client-assets" | "deliverable-assets", assetId: string) =>
    api.delete<{ success: true }>(`/assets/${bucket}/${assetId}`, token),
};
