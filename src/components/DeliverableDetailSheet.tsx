import { useState, useEffect } from "react";
import { backend } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import AssetUploader from "@/components/AssetUploader";
import {
  CheckCircle, Clock, AlertTriangle, Paperclip, Calendar, User,
  Download, Trash2, ThumbsUp, Flag, Image, MessageSquare, Send
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile { user_id: string; full_name: string; internal_label: string | null }
interface DeliverableAsset {
  id: string; file_name: string; file_url: string; file_type: string | null;
  file_size: number | null; created_at: string; uploaded_by: string;
}

export interface DeliverableForSheet {
  id: string; title: string; description: string | null; type: string;
  status: string; due_date: string | null; assigned_to: string | null;
  plan_id: string; priority: string;
  approved_by: string | null; approved_at: string | null;
  estimated_minutes: number | null;
  monthly_plans: { month: number; year: number; clients: { name: string; brand_color: string } | null } | null;
}

interface Comment {
  id: string;
  deliverable_id: string;
  user_id: string;
  body: string;
  created_at: string;
  user: { profile: Profile };
}

interface Props {
  deliverable: DeliverableForSheet | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  teamMembers: Profile[];
  canManage: boolean;
}

const STATUS_FLOW = ["not_started", "in_progress", "in_review", "needs_approval", "approved", "delivered"];
const MEMBER_MAX_STATUS = "needs_approval";

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started", in_progress: "In Progress", in_review: "In Review",
  needs_approval: "Needs Approval", approved: "Approved", delivered: "Delivered",
};

const STATUS_STYLES: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  in_review: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  needs_approval: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  approved: "bg-green-500/10 text-green-600 border-green-500/20",
  delivered: "bg-accent/10 text-accent border-accent/20",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-green-500/10 text-green-600 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  high: "bg-red-500/10 text-red-600 border-red-500/20",
  urgent: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

const PRIORITY_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const TYPE_LABELS: Record<string, string> = {
  post: "Post", reel: "Reel", story: "Story", ad: "Ad",
  campaign: "Campaign", blog: "Blog", newsletter: "Newsletter", other: "Other",
};

export default function DeliverableDetailSheet({ deliverable, open, onClose, onRefresh, teamMembers, canManage }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [assets, setAssets] = useState<DeliverableAsset[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [previewAsset, setPreviewAsset] = useState<DeliverableAsset | null>(null);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>("");

  const isOwner = deliverable?.assigned_to === user?.id;
  const canEdit = canManage || isOwner;
  const memberMaxIdx = STATUS_FLOW.indexOf(MEMBER_MAX_STATUS);

  useEffect(() => {
    if (deliverable) {
      setDescription(deliverable.description || "");
      setEstimatedMinutes(deliverable.estimated_minutes?.toString() || "");
      fetchAssets(deliverable.id);
      fetchComments(deliverable.id);
    }
  }, [deliverable?.id]);

  const fetchAssets = async (id: string) => {
    setLoadingAssets(true);
    const { data } = await backend
      .from("deliverable_assets").select("*").eq("deliverable_id", id).order("created_at", { ascending: false });
    
    if (data) {
      const assetList = data as DeliverableAsset[];
      setAssets(assetList);
      
      // Fetch signed URLs for previews
      assetList.forEach(async (asset) => {
        if (asset.file_type?.startsWith("image/")) {
          const { data: signedData } = await backend.storage
            .from("deliverable-assets")
            .createSignedUrl(asset.id);
          if (signedData?.signedUrl) {
            setSignedUrls(prev => ({ ...prev, [asset.id]: signedData.signedUrl }));
          }
        }
      });
    }
    setLoadingAssets(false);
  };

  const fetchComments = async (id: string) => {
    setLoadingComments(true);
    const { data } = await backend.from("deliverable_comments" as any).select("*, user:users(id, profile:profiles(*))").eq("deliverable_id", id).order("created_at", { ascending: true });
    if (data) setComments(data as any[]);
    setLoadingComments(false);
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !deliverable) return;
    const { data, error } = await backend.from("deliverable_comments" as any).insert({
      deliverable_id: deliverable.id,
      user_id: user?.id,
      body: newComment.trim(),
    }).select("*, user:users(id, profile:profiles(*))").single();
    
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      setComments(prev => [...prev, data as any]);
      setNewComment("");
    }
  };

  const handleDeleteComment = async (id: string) => {
    const { error } = await backend.from("deliverable_comments" as any).delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setComments(prev => prev.filter(c => c.id !== id));
  };

  const handleSaveMetadata = async () => {
    if (!deliverable) return;
    setSaving(true);
    const { error } = await backend.from("deliverables")
      .update({ 
        description,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null 
      })
      .eq("id", deliverable.id);
    setSaving(true);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { 
      toast({ title: "Updated successfully" }); 
      onRefresh(); 
    }
    setSaving(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!deliverable) return;
    // Members can only go up to needs_approval
    if (!canManage) {
      const newIdx = STATUS_FLOW.indexOf(newStatus);
      if (newIdx > memberMaxIdx) return;
    }
    const { error } = await backend.from("deliverables")
      .update({ status: newStatus as any })
      .eq("id", deliverable.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: `Status → ${STATUS_LABELS[newStatus]}` }); onRefresh(); }
  };

  const handleApprove = async () => {
    if (!deliverable) return;
    setApproving(true);
    const { error } = await backend.from("deliverables")
      .update({ status: "approved" as any, approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq("id", deliverable.id);
    setApproving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Deliverable approved ✓" }); onRefresh(); }
  };

  const handlePriorityChange = async (priority: string) => {
    if (!deliverable || !canManage) return;
    const { error } = await backend.from("deliverables")
      .update({ priority } as any)
      .eq("id", deliverable.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Priority updated" }); onRefresh(); }
  };

  const handleAssigneeChange = async (userId: string) => {
    if (!deliverable || !canManage) return;
    const { error } = await backend.from("deliverables")
      .update({ assigned_to: userId === "unassigned" ? null : userId })
      .eq("id", deliverable.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Assignee updated" }); onRefresh(); }
  };

  const handleDueDateChange = async (date: string) => {
    if (!deliverable || !canManage) return;
    const { error } = await backend.from("deliverables")
      .update({ due_date: date || null })
      .eq("id", deliverable.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Due date updated" }); onRefresh(); }
  };

  const handleDeleteAsset = async (assetId: string) => {
    const { error } = await backend.from("deliverable_assets").delete().eq("id", assetId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else if (deliverable) fetchAssets(deliverable.id);
  };

  const getDueDateDisplay = () => {
    if (!deliverable?.due_date) return null;
    const due = new Date(deliverable.due_date);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: "text-red-500" };
    if (diffDays === 0) return { label: "Due today", color: "text-orange-500" };
    if (diffDays <= 2) return { label: `Due in ${diffDays}d`, color: "text-yellow-600" };
    return { label: `Due ${deliverable.due_date}`, color: "text-muted-foreground" };
  };

  const dueDateInfo = getDueDateDisplay();
  const assignee = teamMembers.find(m => m.user_id === deliverable?.assigned_to);
  const approver = teamMembers.find(m => m.user_id === deliverable?.approved_by);

  // Build allowed statuses for selector
  const allowedStatuses = canManage
    ? STATUS_FLOW
    : STATUS_FLOW.filter((_, i) => i <= memberMaxIdx);

  if (!deliverable) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {/* Header */}
        <div
          className="p-6 border-b"
          style={{ borderLeftColor: deliverable.monthly_plans?.clients?.brand_color || "hsl(var(--primary))", borderLeftWidth: 4 }}
        >
          <SheetHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="text-lg font-bold leading-tight">{deliverable.title}</SheetTitle>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                    {deliverable.monthly_plans?.clients?.name}
                  </span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {TYPE_LABELS[deliverable.type]}
                  </span>
                  {deliverable.monthly_plans && (
                    <span className="text-xs text-muted-foreground">
                      {MONTHS[deliverable.monthly_plans.month - 1]} {deliverable.monthly_plans.year}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 items-end shrink-0">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLES[deliverable.status]}`}>
                  {deliverable.status === "needs_approval" && <AlertTriangle className="h-3 w-3" />}
                  {deliverable.status === "approved" && <CheckCircle className="h-3 w-3" />}
                  {STATUS_LABELS[deliverable.status]}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[deliverable.priority]}`}>
                  <Flag className="h-3 w-3" />
                  {PRIORITY_LABELS[deliverable.priority]}
                </span>
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* Approval banner */}
        {deliverable.status === "needs_approval" && canManage && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
              <p className="text-sm font-medium text-orange-700">This deliverable is waiting for your approval.</p>
            </div>
            <Button size="sm" onClick={handleApprove} disabled={approving} className="bg-green-600 hover:bg-green-700 text-white shrink-0">
              <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
              {approving ? "Approving..." : "Approve"}
            </Button>
          </div>
        )}

        {/* Approved banner */}
        {deliverable.status === "approved" && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-700">
              Approved{approver ? ` by ${approver.full_name}` : ""}
              {deliverable.approved_at ? ` on ${new Date(deliverable.approved_at).toLocaleDateString()}` : ""}
            </p>
          </div>
        )}

        <Tabs defaultValue="details" className="mt-4">
          <div className="px-6">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="attachments" className="flex-1">
                Attachments {assets.length > 0 && `(${assets.length})`}
              </TabsTrigger>
              <TabsTrigger value="comments" className="flex-1">
                Comments {comments.length > 0 && `(${comments.length})`}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* DETAILS TAB */}
          <TabsContent value="details" className="px-6 pb-6 space-y-5 mt-4">
            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Status
                </Label>
                {canEdit ? (
                  <Select value={deliverable.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedStatuses.map(s => (
                        <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[deliverable.status]}`}>
                    {STATUS_LABELS[deliverable.status]}
                  </span>
                )}
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Flag className="h-3 w-3" /> Priority
                </Label>
                {canManage ? (
                  <Select value={deliverable.priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["low","medium","high","urgent"].map(p => (
                        <SelectItem key={p} value={p} className="text-xs">{PRIORITY_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[deliverable.priority]}`}>
                    {PRIORITY_LABELS[deliverable.priority]}
                  </span>
                )}
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> Due Date
                </Label>
                {canManage ? (
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    defaultValue={deliverable.due_date || ""}
                    onBlur={(e) => handleDueDateChange(e.target.value)}
                  />
                ) : dueDateInfo ? (
                  <span className={`text-sm font-medium ${dueDateInfo.color}`}>{dueDateInfo.label}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">No due date</span>
                )}
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Assignee
                </Label>
                {canManage ? (
                  <Select
                    value={deliverable.assigned_to || "unassigned"}
                    onValueChange={handleAssigneeChange}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                      {teamMembers.map(m => (
                        <SelectItem key={m.user_id} value={m.user_id} className="text-xs">
                          {m.full_name} {m.internal_label ? `(${m.internal_label})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm">{assignee?.full_name || "Unassigned"}</span>
                )}
              </div>

              {/* Estimated Time */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Est. Minutes
                </Label>
                {canManage ? (
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    placeholder="e.g. 60"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(e.target.value)}
                  />
                ) : (
                  <span className="text-sm">{deliverable.estimated_minutes ? `${deliverable.estimated_minutes}m` : "Not set"}</span>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Description</Label>
              {canEdit ? (
                <div className="space-y-2">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add notes, requirements, or context for this deliverable..."
                    rows={5}
                    className="text-sm resize-none"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveMetadata}
                    disabled={saving || (description === (deliverable.description || "") && estimatedMinutes === (deliverable.estimated_minutes?.toString() || ""))}
                    className="w-full"
                  >
                    {saving ? "Saving..." : "Save Details"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 min-h-[80px]">
                  {deliverable.description || "No description provided."}
                </p>
              )}
            </div>
          </TabsContent>

          {/* ATTACHMENTS TAB */}
          <TabsContent value="attachments" className="px-6 pb-6 mt-4 space-y-4">
            {canEdit && (
              <AssetUploader
                bucket="deliverable-assets"
                folder={deliverable.id}
                assets={[]}
                onUploadComplete={() => fetchAssets(deliverable.id)}
                onDelete={handleDeleteAsset}
                canUpload={true}
                canDelete={canManage || false}
              />
            )}

            {loadingAssets ? (
              <div className="space-y-2">
                {[1,2].map(i => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : assets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No attachments yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {assets.map(asset => {
                  const uploader = teamMembers.find(m => m.user_id === asset.uploaded_by);
                  const canDeleteAsset = canManage || asset.uploaded_by === user?.id;
                  return (
                    <div key={asset.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div 
                          className={cn(
                            "h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden",
                            (asset.file_type?.startsWith("image/") || asset.file_type === "application/pdf") && "cursor-pointer hover:ring-2 ring-primary/50 transition-all"
                          )}
                          onClick={() => (asset.file_type?.startsWith("image/") || asset.file_type === "application/pdf") && setPreviewAsset(asset)}
                        >
                          {asset.file_type?.startsWith("image/") && signedUrls[asset.id] ? (
                            <img src={signedUrls[asset.id]} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Paperclip className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{asset.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {uploader?.full_name || "Unknown"} · {new Date(asset.created_at).toLocaleDateString()}
                            {asset.file_size && ` · ${(asset.file_size / 1024).toFixed(1)}KB`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(asset.file_type?.startsWith("image/") || asset.file_type === "application/pdf") && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewAsset(asset)}>
                            <Image className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <a href={signedUrls[asset.id] || asset.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                        {canDeleteAsset && (
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteAsset(asset.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* COMMENTS TAB */}
          <TabsContent value="comments" className="px-6 pb-6 mt-4 flex flex-col h-[50vh]">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
              {loadingComments ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 bg-muted rounded" />
                        <div className="h-12 w-full bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No comments yet. Start the conversation!</p>
                </div>
              ) : (
                comments.map(comment => {
                  const isMe = comment.user_id === user?.id;
                  return (
                    <div key={comment.id} className={cn("flex gap-3", isMe && "flex-row-reverse")}>
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[10px] font-bold border border-primary/20">
                        {comment.user?.profile?.full_name?.split(" ").map(n => n[0]).join("") || "?"}
                      </div>
                      <div className={cn("flex flex-col max-w-[85%]", isMe && "items-end")}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold">{comment.user?.profile?.full_name}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className={cn(
                          "px-3 py-2 rounded-2xl text-sm",
                          isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted rounded-tl-none"
                        )}>
                          {comment.body}
                        </div>
                        {isMe && (
                          <button 
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-[10px] text-muted-foreground hover:text-destructive mt-1 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input area */}
            <div className="pt-4 border-t sticky bottom-0 bg-background">
              <div className="flex gap-2">
                <Textarea 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Type a message..."
                  className="min-h-[40px] max-h-[120px] resize-none text-sm py-2 px-3 rounded-xl focus-visible:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handlePostComment();
                    }
                  }}
                />
                <Button 
                  size="icon" 
                  className="shrink-0 rounded-full h-10 w-10 shadow-lg"
                  disabled={!newComment.trim()}
                  onClick={handlePostComment}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 px-1">Press Enter to send, Shift+Enter for new line.</p>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>

      <Dialog open={!!previewAsset} onOpenChange={(v) => !v && setPreviewAsset(null)}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-black/95 border-none">
          <DialogHeader className="p-4 bg-background/10 backdrop-blur-md absolute top-0 w-full z-10 border-b border-white/10">
            <DialogTitle className="text-white text-sm font-medium">{previewAsset?.file_name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[60vh] p-4 pt-16 pb-0">
            {previewAsset && signedUrls[previewAsset.id] ? (
              previewAsset.file_type?.startsWith("image/") ? (
                <img
                  src={signedUrls[previewAsset.id]}
                  alt={previewAsset.file_name}
                  className="max-w-full max-h-[75vh] object-contain shadow-2xl rounded-md"
                />
              ) : previewAsset.file_type === "application/pdf" ? (
                <object
                  data={signedUrls[previewAsset.id]}
                  type="application/pdf"
                  className="w-full h-[75vh] rounded-md"
                >
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-white/70">
                    <p className="text-sm">Your browser cannot preview PDFs inline.</p>
                    <a href={signedUrls[previewAsset.id]} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                        <Download className="h-4 w-4 mr-2" /> Open PDF
                      </Button>
                    </a>
                  </div>
                </object>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-white/70">
                  <Paperclip className="h-10 w-10 opacity-50" />
                  <p className="text-sm">Preview not available for this file type.</p>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-40">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              </div>
            )}
          </div>
          <div className="p-4 bg-background/10 backdrop-blur-md flex justify-end gap-2 border-t border-white/10 mt-0">
            <a href={previewAsset ? (signedUrls[previewAsset.id] || previewAsset.file_url) : "#"} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Download className="h-4 w-4 mr-2" /> Download
              </Button>
            </a>
            <Button size="sm" variant="outline" onClick={() => setPreviewAsset(null)} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
