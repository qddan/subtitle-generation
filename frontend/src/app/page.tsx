"use client";

import { useEffect, useRef, useState } from "react";
import {
  Rocket,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  FolderOpen,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE, apiFetch, formatNumber, timestamp } from "@/lib/utils";

interface Stats {
  total: number;
  pending: number;
  processing: number;
  done: number;
  error: number;
}

interface ProgressEvent {
  file_id: number;
  filename: string;
  status: string;
  progress_pct: number;
  message: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [uploading, setUploading] = useState(false);
  const [folderPath, setFolderPath] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStats = () => {
    apiFetch<Stats>("/api/stats")
      .then(setStats)
      .catch(() => {});
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const connectSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const es = new EventSource(`${API_BASE}/api/progress`);
    eventSourceRef.current = es;

    es.addEventListener("progress", (e) => {
      try {
        const data: ProgressEvent = JSON.parse(e.data);
        const ts = timestamp();
        const icon =
          data.status === "done" ? "✅" : data.status === "error" ? "❌" : "⏳";
        setLogs((prev) => [...prev, `[${ts}] ${icon} ${data.message}`]);
        setProgressPct(data.progress_pct);
        setCurrentFile(data.filename);

        if (data.status === "done") {
          fetchStats();
        }
        if (data.status === "error") {
          fetchStats();
          toast.error(`Failed: ${data.filename}`);
        }
      } catch {}
    });

    es.onerror = () => {
      es.close();
      setProcessing(false);
    };
  };

  const handleProcessAll = async () => {
    setProcessing(true);
    setLogs([]);
    setProgressPct(0);
    connectSSE();

    try {
      const res = await apiFetch<{ message: string; total?: number }>(
        "/api/process/all",
        {
          method: "POST",
        },
      );
      toast.info(res.message);
      if (res.total === 0) {
        setProcessing(false);
        eventSourceRef.current?.close();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(msg);
      setProcessing(false);
      eventSourceRef.current?.close();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const res = await fetch(`${API_BASE}/api/upload-files`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.count > 0) {
        toast.success(`Đã upload ${data.count} file(s)`);
        fetchStats();
      } else {
        toast.info("Không có file MP4/TXT nào được upload");
      }
    } catch {
      toast.error("Upload thất bại");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAddFolder = async () => {
    if (!folderPath.trim()) {
      toast.error("Vui lòng nhập đường dẫn folder");
      return;
    }

    try {
      const res = await apiFetch<{
        added: string[];
        count: number;
        skipped: number;
        folder: string;
        recursive: boolean;
      }>("/api/add-folder", {
        method: "POST",
        body: JSON.stringify({ folder_path: folderPath, recursive: true }),
      });
      if (res.count > 0) {
        toast.success(
          `Đã thêm ${res.count} video từ ${res.folder}${res.skipped > 0 ? ` (${res.skipped} đã tồn tại)` : ""}`,
        );
        fetchStats();
        setFolderPath("");
      } else if (res.skipped > 0) {
        toast.info(`${res.skipped} file đã tồn tại trong hệ thống`);
      } else {
        toast.info("Không tìm thấy file MP4/TXT trong folder");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Thêm folder thất bại";
      toast.error(msg);
    }
  };

  const statCards = stats
    ? [
        {
          label: "Total Files",
          value: stats.total,
          icon: FileText,
          color: "text-blue-500",
        },
        {
          label: "Pending",
          value: stats.pending,
          icon: Clock,
          color: "text-slate-500",
        },
        {
          label: "Done",
          value: stats.done,
          icon: CheckCircle2,
          color: "text-emerald-500",
        },
        {
          label: "Errors",
          value: stats.error,
          icon: AlertCircle,
          color: "text-rose-500",
        },
      ]
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Upload video MP4, chuyển thành file text bằng AI Whisper
          </p>
        </div>
        <Button size="lg" onClick={handleProcessAll} disabled={processing}>
          {processing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="mr-2 h-4 w-4" />
          )}
          {processing ? "Processing..." : "Process All Files"}
        </Button>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thêm Video / Folder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {/* File Upload Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp4,.txt"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Video className="mr-2 h-4 w-4" />
              )}
              Chọn Video MP4
            </Button>

            {/* Folder Path Input */}
            <div className="flex flex-1 gap-2 min-w-[300px]">
              <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="/path/to/folder"
                className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button variant="outline" onClick={handleAddFolder}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Thêm Folder
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Hỗ trợ: MP4 (video), TXT (text). Sau khi thêm, nhấn &quot;Process
            All Files&quot; để transcript.
          </p>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards
          ? statCards.map((s) => (
              <Card key={s.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {s.label}
                  </CardTitle>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatNumber(s.value)}
                  </div>
                </CardContent>
              </Card>
            ))
          : Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Progress Bar */}
      {processing && (
        <Card className="border-blue-500/50">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate max-w-[70%]">
                  {currentFile ? currentFile : "Starting..."}
                </span>
                <span className="font-bold text-lg text-blue-500">
                  {progressPct}%
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>🎙️ Transcribing</span>
                <span>
                  {progressPct < 10 && "Loading model..."}
                  {progressPct >= 10 &&
                    progressPct < 80 &&
                    "Processing audio..."}
                  {progressPct >= 80 &&
                    progressPct < 95 &&
                    "Post-processing..."}
                  {progressPct >= 95 && "Saving..."}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live Processing Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={logRef}
            className="h-64 overflow-y-auto rounded-lg bg-muted/50 p-4 font-mono text-sm"
          >
            {logs.length === 0 ? (
              <p className="text-muted-foreground">
                No activity yet. Click &quot;Process All Files&quot; to start.
              </p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="py-0.5">
                  {log}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
