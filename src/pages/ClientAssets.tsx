import { useEffect, useState, useRef } from "react";
import { backend } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Upload, Link2, StickyNote, Plus, Search, Download, Trash2,
  FileIcon, Image, ExternalLink, Globe,
  FolderOpen, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Resolves an asset ID to a displayable URL.
 */
async function resolveSignedUrl(assetId: string): Promise<string> {
  const { data } = await backend.storage.from("client-assets").createSignedUrl(assetId);
  return data?.signedUrl ?? "";
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
  brand_color: string | null;
  logo_url: string | null;
}

interface Asset {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  category: string;
  content_type: string;
  asset_name: string | null;
  notes: string | null;
  section: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: "all", label: "All" },
  { key: "brand_identity", label: "Brand Identity" },
  { key: "social_media", label: "Social Media" },
  { key: "content", label: "Content" },
  { key: "web", label: "Web & Tech" },
  { key: "documents", label: "Documents" },
  { key: "general", label: "General" },
] as const;

const SECTION_DESCRIPTIONS: Record<string, string> = {
  brand_identity: "Logos, brand guides, color palettes, typography",
  social_media: "Profile pictures, cover photos, story templates",
  content: "Photos, videos, copy templates",
  web: "Website files, hosting info, domain details",
  documents: "Contracts, proposals, invoices",
  general: "Miscellaneous brand resources",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(type: string | null) {
  return type?.startsWith("image/");
}

function getDomainIcon(url: string) {
  try {
    const host = new URL(url).hostname;
    if (host.includes("drive.google") || host.includes("docs.google") || host.includes("sheets.google"))
      return { icon: "G", color: "hsl(221, 83%, 53%)", label: "Google" };
    if (host.includes("figma"))
      return { icon: "F", color: "hsl(271, 70%, 60%)", label: "Figma" };
    if (host.includes("notion"))
      return { icon: "N", color: "hsl(0, 0%, 20%)", label: "Notion" };
    if (host.includes("dropbox"))
      return { icon: "D", color: "hsl(213, 87%, 43%)", label: "Dropbox" };
  } catch {}
  return { icon: <Globe className="h-3 w-3" />, color: "hsl(var(--muted-foreground))", label: "Link" };
}

function clientInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FileCard({ asset, canDelete, onDelete, onPreview }: { asset: Asset; canDelete: boolean; onDelete: () => void; onPreview: () => void }) {
  const [displayUrl, setDisplayUrl] = useState("");

  useEffect(() => {
    if (asset.file_url.startsWith("http")) {
      setDisplayUrl(asset.file_url);
    } else {
      resolveSignedUrl(asset.id).then(setDisplayUrl);
    }
  }, [asset.id, asset.file_url]);

  const canPreview = isImage(asset.file_type) || asset.file_type === "application/pdf";

  return (
    <div className="group rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:shadow-md transition-all">
      <div
        className={cn("h-28 w-full rounded-lg bg-muted flex items-center justify-center overflow-hidden", canPreview && displayUrl && "cursor-pointer")}
        onClick={() => canPreview && displayUrl && onPreview()}
      >
        {isImage(asset.file_type) && displayUrl ? (
          <img src={displayUrl} alt={asset.file_name} className="h-full w-full object-cover rounded-lg" />
        ) : asset.file_type === "application/pdf" ? (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <FileIcon className="h-8 w-8" />
            <span className="text-[10px] font-medium uppercase tracking-wide">PDF</span>
          </div>
        ) : (
          <FileIcon className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{asset.asset_name || asset.file_name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{formatSize(asset.file_size)}</p>
        {asset.notes && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{asset.notes}</p>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canPreview && displayUrl && (
          <button onClick={onPreview}
            className="flex-1 flex items-center justify-center gap-1 rounded-md border border-border py-1 text-xs text-muted-foreground hover:bg-muted transition-colors">
            <Image className="h-3 w-3" /> Preview
          </button>
        )}
        {displayUrl && (
          <a href={displayUrl} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1 rounded-md border border-border py-1 text-xs text-muted-foreground hover:bg-muted transition-colors">
            <Download className="h-3 w-3" /> Download
          </a>
        )}
        {canDelete && (
          <button onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        )}
      </div>
    </div>
  );
}

function LinkCard({ asset, canDelete, onDelete }: { asset: Asset; canDelete: boolean; onDelete: () => void }) {
  const domain = getDomainIcon(asset.file_url);
  return (
    <div className="group rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:shadow-md transition-all">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ backgroundColor: typeof domain.color === "string" ? domain.color : "hsl(var(--muted))" }}>
          {typeof domain.icon === "string" ? domain.icon : domain.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{asset.asset_name || "Untitled Link"}</p>
          <p className="text-[11px] text-muted-foreground truncate">{domain.label}</p>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground truncate border border-border rounded-md px-2 py-1 bg-muted/40">
        {asset.file_url}
      </p>
      {asset.notes && <p className="text-[11px] text-muted-foreground line-clamp-2">{asset.notes}</p>}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a href={asset.file_url} target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1 rounded-md border border-border py-1 text-xs text-muted-foreground hover:bg-muted transition-colors">
          <ExternalLink className="h-3 w-3" /> Open Link
        </a>
        {canDelete && (
          <button onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        )}
      </div>
    </div>
  );
}

function NoteCard({ asset, canDelete, onDelete }: { asset: Asset; canDelete: boolean; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="group rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:shadow-md transition-all">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
          <StickyNote className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="text-sm font-medium truncate flex-1">{asset.asset_name || "Untitled Note"}</p>
      </div>
      <p className={cn("text-xs text-muted-foreground leading-relaxed", expanded ? "" : "line-clamp-4")}>
        {asset.notes || asset.file_name}
      </p>
      {(asset.notes || asset.file_name).length > 120 && (
        <button onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-primary hover:underline text-left">
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
      {canDelete && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Add Asset Dialogs ────────────────────────────────────────────────────────

type AddMode = "file" | "link" | "note" | null;

function AddAssetDialog({
  mode, clientId, onClose, onDone, canUpload,
}: {
  mode: AddMode;
  clientId: string;
  onClose: () => void;
  onDone: () => void;
  canUpload: boolean;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState("general");
  const [assetName, setAssetName] = useState("");
  const [url, setUrl] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [uploading, setUploading] = useState(false);

  const sectionOptions = SECTIONS.filter(s => s.key !== "all");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const filePath = `${clientId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await backend.storage.from("client-assets").upload(filePath, file);
      if (uploadError) { toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" }); continue; }
      // Store the file PATH (not public URL) — bucket is now private
      const { error } = await backend.from("client_assets").insert({
        client_id: clientId,
        file_name: file.name,
        file_url: filePath,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.id,
        content_type: "file",
        asset_name: assetName || file.name,
        section,
        category: "other",
      } as any);
      if (error) toast({ title: "Error saving asset", description: error.message, variant: "destructive" });
    }
    setUploading(false);
    onDone();
    onClose();
  };

  const handleAddLink = async () => {
    if (!url.trim() || !user) return;
    setUploading(true);
    const { error } = await backend.from("client_assets").insert({
      client_id: clientId,
      file_name: assetName || url,
      file_url: url.trim(),
      uploaded_by: user.id,
      content_type: "link",
      asset_name: assetName || url,
      section,
      category: "other",
    } as any);
    setUploading(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    onDone(); onClose();
  };

  const handleAddNote = async () => {
    if (!noteContent.trim() || !user) return;
    setUploading(true);
    const { error } = await backend.from("client_assets").insert({
      client_id: clientId,
      file_name: assetName || "Note",
      file_url: "",
      uploaded_by: user.id,
      content_type: "note",
      asset_name: assetName || "Untitled Note",
      notes: noteContent.trim(),
      section,
      category: "other",
    } as any);
    setUploading(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    onDone(); onClose();
  };

  if (!mode) return null;

  const titles = { file: "Upload File", link: "Add Drive / External Link", note: "Add Text Note" };

  return (
    <Dialog open={!!mode} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titles[mode]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Section selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Section</label>
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {sectionOptions.map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {SECTION_DESCRIPTIONS[section] && (
              <p className="text-[11px] text-muted-foreground">{SECTION_DESCRIPTIONS[section]}</p>
            )}
          </div>

          {/* Label/name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Label {mode === "file" ? "(optional)" : ""}</label>
            <Input placeholder="e.g. Primary Logo, Drive Folder..." value={assetName} onChange={e => setAssetName(e.target.value)} />
          </div>

          {/* Mode-specific fields */}
          {mode === "file" && (
            <>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" />
              <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading…" : "Choose Files"}
              </Button>
            </>
          )}

          {mode === "link" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">URL</label>
              <Input placeholder="https://drive.google.com/..." value={url} onChange={e => setUrl(e.target.value)} />
            </div>
          )}

          {mode === "note" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Note Content</label>
              <Textarea
                placeholder="Brand colors: #FF5733 (Primary), #333333 (Text)..."
                rows={5}
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
              />
            </div>
          )}
        </div>

        {mode !== "file" && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={mode === "link" ? handleAddLink : handleAddNote} disabled={uploading}>
              {uploading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientAssets() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [activeSection, setActiveSection] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "file" | "link" | "note">("all");
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [clientSearch, setClientSearch] = useState("");

  const canManage = role === "admin" || role === "manager";
  const canDelete = role === "admin";
  const [previewingAsset, setPreviewingAsset] = useState<Asset | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  // Fetch clients
  useEffect(() => {
    backend.from("clients").select("id, name, brand_color, logo_url")
      .eq("is_active", true).order("name")
      .then(({ data }) => {
        if (data) {
          setClients(data as Client[]);
          if (data.length > 0) setSelectedClient(data[0].id);
        }
        setLoadingClients(false);
      });
  }, []);

  const fetchAssets = async () => {
    if (!selectedClient) return;
    const { data } = await backend.from("client_assets").select("*")
      .eq("client_id", selectedClient)
      .order("created_at", { ascending: false });
    if (data) setAssets(data as Asset[]);
  };

  useEffect(() => { fetchAssets(); }, [selectedClient]);

  const handleDelete = async (assetId: string) => {
    const { error } = await backend.from("client_assets").delete().eq("id", assetId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchAssets();
  };

  const handlePreview = async (asset: Asset) => {
    setPreviewingAsset(asset);
    setPreviewUrl("");
    if (asset.file_url.startsWith("http")) {
      setPreviewUrl(asset.file_url);
    } else {
      const url = await resolveSignedUrl(asset.id);
      setPreviewUrl(url);
    }
  };

  // Filtered assets
  const filtered = assets.filter(a => {
    if (activeSection !== "all" && a.section !== activeSection) return false;
    if (typeFilter !== "all" && a.content_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (a.asset_name || a.file_name).toLowerCase().includes(q) ||
        a.file_url.toLowerCase().includes(q) ||
        (a.notes || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Count per section
  const sectionCounts = SECTIONS.reduce((acc, s) => {
    acc[s.key] = s.key === "all" ? assets.length : assets.filter(a => a.section === s.key).length;
    return acc;
  }, {} as Record<string, number>);

  // Filtered clients
  const visibleClients = clients.filter(c =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const selectedClientObj = clients.find(c => c.id === selectedClient);

  return (
    <div className="animate-fade-in h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-5 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brand Assets</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage brand resources, files, links and notes per client.</p>
        </div>
        {canManage && selectedClient && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Asset
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setAddMode("file")}>
                <Upload className="mr-2 h-4 w-4 text-primary" /> Upload File
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAddMode("link")}>
                <Link2 className="mr-2 h-4 w-4 text-blue-500" /> Add Drive / Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAddMode("note")}>
                <StickyNote className="mr-2 h-4 w-4 text-amber-500" /> Add Note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Client Sidebar */}
        <div className="w-56 shrink-0 flex flex-col gap-3 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search clients…"
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {loadingClients ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))
            ) : visibleClients.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-4 text-center">No clients found</p>
            ) : (
              visibleClients.map(c => {
                const isActive = c.id === selectedClient;
                const count = assets.filter(a => a.content_type).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedClient(c.id); setActiveSection("all"); setSearch(""); setTypeFilter("all"); }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all text-sm",
                      isActive
                        ? "bg-primary/10 text-primary font-medium ring-1 ring-primary/20"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    {/* Brand color dot / logo */}
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden"
                      style={{ backgroundColor: c.brand_color || "hsl(var(--primary))" }}
                    >
                      {c.logo_url ? (
                        <img src={c.logo_url} alt={c.name} className="h-full w-full object-cover" />
                      ) : (
                        clientInitials(c.name)
                      )}
                    </div>
                    <span className="flex-1 truncate">{c.name}</span>
                    {isActive && assets.length > 0 && (
                      <span className="text-[10px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-medium">
                        {assets.length}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {!selectedClient ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">Select a client to manage their brand assets.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Client header */}
              {selectedClientObj && (
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border shrink-0">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                    style={{ backgroundColor: selectedClientObj.brand_color || "hsl(var(--primary))" }}
                  >
                    {selectedClientObj.logo_url ? (
                      <img src={selectedClientObj.logo_url} alt={selectedClientObj.name} className="h-full w-full object-cover" />
                    ) : clientInitials(selectedClientObj.name)}
                  </div>
                  <div>
                    <h2 className="font-semibold text-sm">{selectedClientObj.name}</h2>
                    <p className="text-[11px] text-muted-foreground">{assets.length} asset{assets.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              )}

              {/* Section tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1 mb-4 shrink-0 scrollbar-none">
                {SECTIONS.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setActiveSection(s.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0",
                      activeSection === s.key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    {s.label}
                    {sectionCounts[s.key] > 0 && (
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        activeSection === s.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background text-muted-foreground"
                      )}>
                        {sectionCounts[s.key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Filter bar */}
              <div className="flex items-center gap-2 mb-4 shrink-0">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search assets…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2 top-2">
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {(["all", "file", "link", "note"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all capitalize",
                        typeFilter === t
                          ? "bg-secondary text-secondary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {t === "all" ? "All Types" : t === "file" ? "📄 Files" : t === "link" ? "🔗 Links" : "📝 Notes"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 border border-dashed border-border rounded-xl">
                    <FolderOpen className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {search || typeFilter !== "all" ? "No assets match your filters." : "No assets in this section yet."}
                    </p>
                    {canManage && !search && (
                      <p className="text-xs text-muted-foreground mt-1">Use "Add Asset" to get started.</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
                    {filtered.map(asset => {
                      const props = { asset, canDelete, onDelete: () => handleDelete(asset.id), onPreview: () => handlePreview(asset) };
                      if (asset.content_type === "link") return <LinkCard key={asset.id} asset={asset} canDelete={canDelete} onDelete={() => handleDelete(asset.id)} />;
                      if (asset.content_type === "note") return <NoteCard key={asset.id} asset={asset} canDelete={canDelete} onDelete={() => handleDelete(asset.id)} />;
                      return <FileCard key={asset.id} {...props} />;
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add asset dialog */}
      {addMode && (
        <AddAssetDialog
          mode={addMode}
          clientId={selectedClient}
          onClose={() => setAddMode(null)}
          onDone={fetchAssets}
          canUpload={canManage}
        />
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewingAsset} onOpenChange={(v) => !v && setPreviewingAsset(null)}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-black/95 border-none">
          <DialogHeader className="p-4 bg-background/10 backdrop-blur-md absolute top-0 w-full z-10 border-b border-white/10">
            <DialogTitle className="text-white text-sm font-medium">{previewingAsset?.asset_name || previewingAsset?.file_name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[60vh] p-4 pt-16 pb-0">
            {previewUrl ? (
              isImage(previewingAsset?.file_type ?? null) ? (
                <img src={previewUrl} alt={previewingAsset?.file_name} className="max-w-full max-h-[75vh] object-contain shadow-2xl rounded-md" />
              ) : previewingAsset?.file_type === "application/pdf" ? (
                <object data={previewUrl} type="application/pdf" className="w-full h-[75vh] rounded-md">
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-white/70">
                    <p className="text-sm">Your browser cannot preview PDFs inline.</p>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                      <button className="px-4 py-2 rounded-md bg-white/10 text-white text-sm border border-white/20 hover:bg-white/20">Open PDF</button>
                    </a>
                  </div>
                </object>
              ) : null
            ) : (
              <div className="flex items-center justify-center h-40">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              </div>
            )}
          </div>
          <div className="p-4 bg-background/10 backdrop-blur-md flex justify-end gap-2 border-t border-white/10 mt-0">
            {previewUrl && (
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <button className="px-3 py-1.5 text-sm rounded-md bg-white/10 border border-white/20 text-white hover:bg-white/20 flex items-center gap-2">
                  <Download className="h-4 w-4" /> Download
                </button>
              </a>
            )}
            <button onClick={() => setPreviewingAsset(null)} className="px-3 py-1.5 text-sm rounded-md bg-white/10 border border-white/20 text-white hover:bg-white/20">Close</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
