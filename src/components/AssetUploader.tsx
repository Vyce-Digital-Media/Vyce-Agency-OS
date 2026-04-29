import { useState, useRef, useEffect } from "react";
import { backend } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileIcon, Trash2, Download } from "lucide-react";

interface Asset {
  id: string;
  file_name: string;
  file_url: string; // may be a file path (new) or a legacy full https:// URL
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  category?: string;
}

interface AssetUploaderProps {
  bucket: "deliverable-assets" | "client-assets";
  folder: string; // e.g. deliverable ID or client ID
  assets: Asset[];
  onUploadComplete: () => void;
  onDelete: (assetId: string) => void;
  canUpload: boolean;
  canDelete: boolean;
  showCategory?: boolean;
}

const CATEGORIES = ["logo", "brand_guide", "font", "template", "photo", "other"];
const CATEGORY_LABELS: Record<string, string> = {
  logo: "Logo", brand_guide: "Brand Guide", font: "Font",
  template: "Template", photo: "Photo", other: "Other",
};

/**
 * Resolves a stored file_url to a displayable URL.
 * - Legacy rows store the full public CDN URL → return as-is (backward compat)
 * - New rows store only the file path → generate a 1-hour signed URL
 */
async function resolveSignedUrl(bucket: string, fileUrl: string): Promise<string> {
  if (!fileUrl) return "";
  if (fileUrl.startsWith("http")) return fileUrl; // legacy public URL
  const { data } = await backend.storage.from(bucket).createSignedUrl(fileUrl, 3600);
  return data?.signedUrl ?? "";
}

export default function AssetUploader({
  bucket, folder, assets, onUploadComplete, onDelete, canUpload, canDelete, showCategory,
}: AssetUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("other");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Resolve signed URLs for all assets that use paths (not legacy URLs)
  useEffect(() => {
    if (assets.length === 0) return;
    const pathAssets = assets.filter(a => a.file_url && !a.file_url.startsWith("http"));
    if (pathAssets.length === 0) return;

    Promise.all(
      pathAssets.map(async (a) => {
        const url = await resolveSignedUrl(bucket, a.file_url);
        return [a.id, url] as [string, string];
      })
    ).then((entries) => {
      setSignedUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
  }, [assets, bucket]);

  const getDisplayUrl = (asset: Asset) => {
    if (asset.file_url.startsWith("http")) return asset.file_url;
    return signedUrls[asset.id] ?? "";
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      const filePath = `${folder}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await backend.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        continue;
      }

      // Store the file PATH (not public URL) — bucket is now private
      const insertData: any = {
        file_name: file.name,
        file_url: filePath,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.id,
      };

      if (bucket === "deliverable-assets") {
        insertData.deliverable_id = folder;
      } else {
        insertData.client_id = folder;
        insertData.category = category;
      }

      const tableName = bucket === "deliverable-assets" ? "deliverable_assets" : "client_assets";
      const { error: dbError } = await backend.from(tableName).insert(insertData);

      if (dbError) {
        toast({ title: "Error saving asset", description: dbError.message, variant: "destructive" });
      }
    }

    setUploading(false);
    onUploadComplete();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isImage = (type: string | null) => type?.startsWith("image/");

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {canUpload && (
        <div className="flex items-center gap-3">
          {showCategory && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : "Upload Files"}
          </Button>
        </div>
      )}

      {assets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <FileIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {assets.map((asset) => {
            const displayUrl = getDisplayUrl(asset);
            return (
              <div key={asset.id} className="rounded-lg border border-border p-3 flex items-start gap-3 group hover:shadow-sm transition-shadow">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {isImage(asset.file_type) && displayUrl ? (
                    <img src={displayUrl} alt={asset.file_name} className="h-full w-full object-cover rounded-lg" />
                  ) : (
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{asset.file_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatSize(asset.file_size)}
                    {asset.category && ` · ${CATEGORY_LABELS[asset.category] || asset.category}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {displayUrl && (
                    <a
                      href={displayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-muted"
                    >
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => onDelete(asset.id)}
                      className="p-1 rounded hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
