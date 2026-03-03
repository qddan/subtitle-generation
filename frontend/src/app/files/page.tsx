"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Play, Eye, Loader2, FileText, FileVideo, Link2, Presentation } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { apiFetch, formatNumber } from "@/lib/utils";

interface FileItem {
  id: number;
  filename: string;
  filetype: string;
  status: string;
  word_count: number;
  duration_sec: number;
}

interface Transcript {
  filename: string;
  text: string;
  word_count: number;
}

const typeIcons: Record<string, React.ReactNode> = {
  mp4: <FileVideo className="h-4 w-4 text-blue-500" />,
  txt: <FileText className="h-4 w-4 text-emerald-500" />,
  url: <Link2 className="h-4 w-4 text-violet-500" />,
  slides: <Presentation className="h-4 w-4 text-amber-500" />,
};

const statusVariant: Record<string, "pending" | "processing" | "done" | "error"> = {
  pending: "pending",
  processing: "processing",
  done: "done",
  error: "error",
};

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [viewTranscript, setViewTranscript] = useState<Transcript | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  const fetchFiles = useCallback(async (showToast = false) => {
    try {
      setScanning(true);
      const data = await apiFetch<FileItem[]>("/api/files");
      setFiles(data);
      if (showToast) toast.success(`Found ${data.length} files`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Auto-refresh during processing
  useEffect(() => {
    const hasProcessing = files?.some((f) => f.status === "processing");
    if (!hasProcessing) return;
    const interval = setInterval(() => fetchFiles(), 3000);
    return () => clearInterval(interval);
  }, [files, fetchFiles]);

  const handleProcess = async (id: number) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    try {
      await apiFetch(`/api/process/${id}`, { method: "POST" });
      toast.success("Processing complete");
      fetchFiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Processing failed";
      toast.error(msg);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleView = async (id: number) => {
    setLoadingTranscript(true);
    setDialogOpen(true);
    try {
      const data = await apiFetch<Transcript>(`/api/transcript/${id}`);
      setViewTranscript(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load transcript";
      toast.error(msg);
      setDialogOpen(false);
    } finally {
      setLoadingTranscript(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Files</h2>
          <p className="text-muted-foreground">Manage and process your source files</p>
        </div>
        <Button onClick={() => fetchFiles(true)} disabled={scanning}>
          {scanning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Scan Folder
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source Files</CardTitle>
        </CardHeader>
        <CardContent>
          {files === null ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">No files found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add .mp4, .url, or .txt files to your local folder, then click &quot;Scan Folder&quot;
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">#</th>
                    <th className="pb-3 pr-4 font-medium">Filename</th>
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">Words</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file, idx) => (
                    <tr
                      key={file.id}
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 pr-4 text-muted-foreground">{idx + 1}</td>
                      <td className="py-3 pr-4 font-medium">{file.filename}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          {typeIcons[file.filetype] || <FileText className="h-4 w-4" />}
                          <span className="uppercase text-xs">{file.filetype}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusVariant[file.status] || "secondary"}>
                          {file.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {file.word_count > 0 ? formatNumber(file.word_count) : "—"}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(file.status === "pending" || file.status === "error") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleProcess(file.id)}
                              disabled={processingIds.has(file.id)}
                            >
                              {processingIds.has(file.id) ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="mr-1 h-3 w-3" />
                              )}
                              Process
                            </Button>
                          )}
                          {file.status === "done" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleView(file.id)}
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              View
                            </Button>
                          )}
                          {file.status === "processing" && (
                            <Badge variant="processing">
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              Working...
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewTranscript?.filename || "Transcript"}</DialogTitle>
            <DialogDescription>
              {viewTranscript ? `${formatNumber(viewTranscript.word_count)} words` : "Loading..."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto rounded-lg bg-muted/50 p-4">
            {loadingTranscript ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                {viewTranscript?.text}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
