"use client";

import { useEffect, useState } from "react";
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, formatNumber } from "@/lib/utils";

interface Stats {
  total: number;
  pending: number;
  processing: number;
  done: number;
  error: number;
}

interface UploadResult {
  success: number;
  failed: { filename: string; error: string }[];
  notebook_url?: string;
  files?: { filename: string; path: string }[];
  message?: string;
}

interface Notebook {
  id: string;
  name: string;
  url: string;
}

export default function UploadPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[] | null>(null);
  const [notebookId, setNotebookId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [loadingNotebooks, setLoadingNotebooks] = useState(false);

  useEffect(() => {
    apiFetch<Stats>("/api/stats")
      .then(setStats)
      .catch(() => {});
  }, []);

  const fetchNotebooks = async () => {
    setLoadingNotebooks(true);
    try {
      const data = await apiFetch<
        Notebook[] | { raw?: string; error?: string }
      >("/api/notebooks");
      if (Array.isArray(data)) {
        setNotebooks(data);
        if (data.length > 0) setNotebookId(data[0].id);
      } else {
        toast.info("Notebooks response received. Check notebooklm-mcp setup.");
        setNotebooks([]);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch notebooks";
      toast.error(msg);
      setNotebooks([]);
    } finally {
      setLoadingNotebooks(false);
    }
  };

  const handleUpload = async () => {
    if (!notebookId) {
      toast.error("Please select or enter a notebook ID");
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const data = await apiFetch<UploadResult>("/api/upload-notebooklm", {
        method: "POST",
        body: JSON.stringify({ notebook_id: notebookId }),
      });
      setResult(data);
      if (data.failed.length === 0) {
        toast.success(`Successfully uploaded ${data.success} transcripts`);
      } else {
        toast.warning(`${data.success} uploaded, ${data.failed.length} failed`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Upload to NotebookLM
        </h2>
        <p className="text-muted-foreground">
          Send processed transcripts to Google NotebookLM
        </p>
      </div>

      {/* Ready Count */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Transcripts Ready
          </CardTitle>
          <CardDescription>
            Completed transcripts available for upload
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats === null ? (
            <Skeleton className="h-10 w-24" />
          ) : (
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatNumber(stats.done)}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                of {formatNumber(stats.total)} files
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notebook Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Notebook</CardTitle>
          <CardDescription>
            Choose which NotebookLM notebook to upload to
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={fetchNotebooks}
              disabled={loadingNotebooks}
            >
              {loadingNotebooks ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BookOpen className="mr-2 h-4 w-4" />
              )}
              Load Notebooks
            </Button>
            {notebooks && notebooks.length > 0 && (
              <select
                value={notebookId}
                onChange={(e) => setNotebookId(e.target.value)}
                className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {notebooks.map((nb) => (
                  <option key={nb.id} value={nb.id}>
                    {nb.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Or enter notebook ID:
            </span>
            <input
              type="text"
              value={notebookId}
              onChange={(e) => setNotebookId(e.target.value)}
              placeholder="notebook_id"
              className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </CardContent>
      </Card>

      {/* Upload Button */}
      <Card>
        <CardContent className="pt-6">
          <Button
            size="lg"
            className="w-full"
            onClick={handleUpload}
            disabled={uploading || !notebookId || (stats?.done ?? 0) === 0}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Upload All to NotebookLM"}
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className="border-emerald-500">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">
                {result.message || `${result.success} file(s) ready`}
              </span>
            </div>

            {result.notebook_url && (
              <a
                href={result.notebook_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                <BookOpen className="h-5 w-5" />
                Mở NotebookLM để upload tài liệu
              </a>
            )}

            {result.files && result.files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Files sẵn sàng upload:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {result.files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span className="font-mono">{f.filename}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.failed.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Lỗi:
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {result.failed.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="font-mono">{f.filename}</span>
                      <span className="text-rose-500">— {f.error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Cách lấy Notebook ID
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Mở{" "}
                  <a
                    href="https://notebooklm.google.com"
                    target="_blank"
                    rel="noopener"
                    className="text-blue-500 underline"
                  >
                    notebooklm.google.com
                  </a>
                </li>
                <li>Tạo hoặc mở notebook của bạn</li>
                <li>
                  Copy ID từ URL:{" "}
                  <code className="bg-muted px-1 rounded">
                    notebooklm.google.com/notebook/<strong>ABC123</strong>
                  </code>
                </li>
                <li>Dán ID vào ô trên và nhấn Upload</li>
              </ol>
              <p className="mt-2">
                Sau khi upload, bạn có thể mở notebook để xem tài liệu đã được
                thêm.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Link */}
      {notebookId && (
        <Card>
          <CardContent className="pt-6">
            <a
              href={`https://notebooklm.google.com/notebook/${notebookId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-500 hover:text-blue-600 underline"
            >
              <BookOpen className="h-4 w-4" />
              Mở NotebookLM: {notebookId}
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
