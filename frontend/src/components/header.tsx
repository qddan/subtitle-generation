"use client";

import { CircleDot } from "lucide-react";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <h1 className="text-lg font-semibold text-foreground">
        Video2Text — AI Transcription
      </h1>
      <div className="flex items-center gap-2 text-sm">
        <CircleDot className="h-3 w-3 text-emerald-500" />
        <span className="text-muted-foreground">Whisper AI</span>
      </div>
    </header>
  );
}
