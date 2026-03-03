import asyncio
import json
import os
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from typing import List

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

LOCAL_FOLDER = os.getenv("LOCAL_FOLDER", ".")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./transcripts")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
LANGUAGE = os.getenv("LANGUAGE", "vi")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", str(500 * 1024 * 1024)))  # 500MB default

DB_PATH = os.path.join(os.path.dirname(__file__), "db.sqlite3")

# Resolve OUTPUT_DIR relative to backend dir
if not os.path.isabs(OUTPUT_DIR):
    OUTPUT_DIR = os.path.join(os.path.dirname(__file__), OUTPUT_DIR)

os.makedirs(OUTPUT_DIR, exist_ok=True)

app = FastAPI(title="Video2Text API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# SSE progress queue
# ---------------------------------------------------------------------------
progress_subscribers: list[asyncio.Queue] = []


async def broadcast_progress(data: dict):
    for q in progress_subscribers:
        await q.put(data)


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL UNIQUE,
            filetype TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            word_count INTEGER DEFAULT 0,
            duration_sec REAL DEFAULT 0,
            error_msg TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.commit()
    return conn


def detect_filetype(filename: str) -> str | None:
    ext = Path(filename).suffix.lower()
    mapping = {".mp4": "mp4", ".txt": "txt"}
    return mapping.get(ext)


# ---------------------------------------------------------------------------
# Upload directory for user-uploaded files
# ---------------------------------------------------------------------------
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/upload-files")
async def upload_files(files: List[UploadFile] = File(...)):
    """Upload MP4 files for transcription."""
    db = get_db()
    now = datetime.utcnow().isoformat()
    uploaded = []
    
    for file in files:
        if not file.filename:
            continue
        
        ftype = detect_filetype(file.filename)
        if ftype not in ["mp4", "txt"]:
            continue
        
        # Sanitize filename — prevent path traversal
        safe_filename = Path(file.filename).name.replace(" ", "_")
        filepath = os.path.join(UPLOAD_DIR, safe_filename)
        
        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE:
            continue  # Skip files that are too large
        
        with open(filepath, "wb") as f:
            f.write(content)
        
        # Check if already exists in DB
        existing = db.execute("SELECT id FROM files WHERE filepath = ?", (filepath,)).fetchone()
        if existing is None:
            db.execute(
                "INSERT INTO files (filename, filepath, filetype, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                (safe_filename, filepath, ftype, "pending", now, now),
            )
            uploaded.append(safe_filename)
        else:
            uploaded.append(f"{safe_filename} (updated)")
    
    db.commit()
    db.close()
    
    return {"uploaded": uploaded, "count": len(uploaded)}


@app.post("/api/add-folder")
async def add_folder(request: Request):
    """Add all video files from a local folder path (including subfolders)."""
    body = await request.json()
    folder_path = body.get("folder_path", "")
    recursive = body.get("recursive", True)  # Default: scan subfolders
    
    if not folder_path or not os.path.isdir(folder_path):
        raise HTTPException(status_code=400, detail="Invalid folder path")
    
    # Resolve to absolute path to prevent path traversal
    folder_path = os.path.realpath(folder_path)
    
    db = get_db()
    now = datetime.utcnow().isoformat()
    added = []
    skipped = []
    
    # Walk through folder (and subfolders if recursive)
    if recursive:
        for root, dirs, files in os.walk(folder_path):
            for f in files:
                ftype = detect_filetype(f)
                if ftype not in ["mp4", "txt"]:
                    continue
                
                fpath = os.path.join(root, f)
                existing = db.execute("SELECT id FROM files WHERE filepath = ?", (fpath,)).fetchone()
                if existing is None:
                    db.execute(
                        "INSERT INTO files (filename, filepath, filetype, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                        (f, fpath, ftype, "pending", now, now),
                    )
                    added.append(f)
                else:
                    skipped.append(f)
    else:
        for f in os.listdir(folder_path):
            ftype = detect_filetype(f)
            if ftype not in ["mp4", "txt"]:
                continue
            
            fpath = os.path.join(folder_path, f)
            if not os.path.isfile(fpath):
                continue
            
            existing = db.execute("SELECT id FROM files WHERE filepath = ?", (fpath,)).fetchone()
            if existing is None:
                db.execute(
                    "INSERT INTO files (filename, filepath, filetype, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                    (f, fpath, ftype, "pending", now, now),
                )
                added.append(f)
            else:
                skipped.append(f)
    
    db.commit()
    db.close()
    
    return {
        "added": added,
        "count": len(added),
        "skipped": len(skipped),
        "folder": folder_path,
        "recursive": recursive,
    }


@app.get("/api/files")
def list_files():
    """List files from the database. Only auto-scan LOCAL_FOLDER for mp4 videos."""
    db = get_db()
    now = datetime.utcnow().isoformat()

    if os.path.isdir(LOCAL_FOLDER):
        for f in os.listdir(LOCAL_FOLDER):
            ftype = detect_filetype(f)
            if ftype != "mp4":
                continue
            fpath = os.path.join(LOCAL_FOLDER, f)
            if not os.path.isfile(fpath):
                continue
            existing = db.execute("SELECT id FROM files WHERE filepath = ?", (fpath,)).fetchone()
            if existing is None:
                db.execute(
                    "INSERT INTO files (filename, filepath, filetype, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                    (f, fpath, ftype, "pending", now, now),
                )
        db.commit()

    rows = db.execute(
        "SELECT id, filename, filetype, status, word_count, duration_sec FROM files ORDER BY filename"
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.get("/api/stats")
def get_stats():
    db = get_db()
    total = db.execute("SELECT COUNT(*) FROM files").fetchone()[0]
    pending = db.execute("SELECT COUNT(*) FROM files WHERE status='pending'").fetchone()[0]
    processing = db.execute("SELECT COUNT(*) FROM files WHERE status='processing'").fetchone()[0]
    done = db.execute("SELECT COUNT(*) FROM files WHERE status='done'").fetchone()[0]
    error = db.execute("SELECT COUNT(*) FROM files WHERE status='error'").fetchone()[0]
    db.close()
    return {"total": total, "pending": pending, "processing": processing, "done": done, "error": error}


@app.post("/api/process/{file_id}")
async def process_file(file_id: int):
    db = get_db()
    row = db.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="File not found")

    file = dict(row)
    now = datetime.utcnow().isoformat()
    db.execute("UPDATE files SET status='processing', updated_at=? WHERE id=?", (now, file_id))
    db.commit()

    await broadcast_progress({
        "file_id": file_id,
        "filename": file["filename"],
        "status": "processing",
        "progress_pct": 0,
        "message": f"Starting: {file['filename']}",
    })

    try:
        if file["filetype"] == "mp4":
            from transcribe import transcribe_video

            # Progress callback to broadcast updates
            async def progress_cb(pct: int, msg: str):
                await broadcast_progress({
                    "file_id": file_id,
                    "filename": file["filename"],
                    "status": "processing",
                    "progress_pct": pct,
                    "message": f"{file['filename']}: {msg}",
                })

            # Sync wrapper for progress callback
            def sync_progress_cb(pct: int, msg: str):
                import asyncio
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        asyncio.create_task(progress_cb(pct, msg))
                    else:
                        loop.run_until_complete(progress_cb(pct, msg))
                except Exception:
                    pass

            result = transcribe_video(
                file["filepath"],
                model_size=WHISPER_MODEL,
                language=LANGUAGE,
                output_dir=OUTPUT_DIR,
                progress_callback=sync_progress_cb,
            )
            word_count = result["word_count"]
            duration_sec = result["duration_sec"]

        elif file["filetype"] == "txt":
            stem = Path(file["filename"]).stem
            out_path = os.path.join(OUTPUT_DIR, f"{stem}.txt")
            shutil.copy2(file["filepath"], out_path)
            with open(out_path, "r", encoding="utf-8") as f:
                text = f.read()
            word_count = len(text.split())
            duration_sec = 0

        else:
            raise ValueError(f"Unsupported filetype: {file['filetype']}")

        now = datetime.utcnow().isoformat()
        db.execute(
            "UPDATE files SET status='done', word_count=?, duration_sec=?, updated_at=? WHERE id=?",
            (word_count, duration_sec, now, file_id),
        )
        db.commit()

        await broadcast_progress({
            "file_id": file_id,
            "filename": file["filename"],
            "status": "done",
            "progress_pct": 100,
            "message": f"Done: {file['filename']} → {word_count:,} words",
        })

        return {"status": "done", "word_count": word_count, "duration_sec": duration_sec}

    except Exception as e:
        now = datetime.utcnow().isoformat()
        db.execute(
            "UPDATE files SET status='error', error_msg=?, updated_at=? WHERE id=?",
            (str(e), now, file_id),
        )
        db.commit()

        await broadcast_progress({
            "file_id": file_id,
            "filename": file["filename"],
            "status": "error",
            "progress_pct": 0,
            "message": f"Error: {file['filename']} — {str(e)}",
        })

        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.post("/api/process/all")
async def process_all():
    db = get_db()
    rows = db.execute("SELECT id FROM files WHERE status IN ('pending', 'error')").fetchall()
    db.close()

    file_ids = [r["id"] for r in rows]
    total = len(file_ids)

    if total == 0:
        return {"message": "No pending files to process"}

    async def _run():
        for idx, fid in enumerate(file_ids):
            await broadcast_progress({
                "file_id": fid,
                "filename": "",
                "status": "queue",
                "progress_pct": round((idx / total) * 100),
                "message": f"Processing {idx + 1}/{total}",
            })
            try:
                await process_file(fid)
            except HTTPException:
                pass  # Already logged

    asyncio.create_task(_run())
    return {"message": f"Started processing {total} files", "total": total}


@app.get("/api/progress")
async def progress_stream(request: Request):
    q: asyncio.Queue = asyncio.Queue()
    progress_subscribers.append(q)

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(q.get(), timeout=30)
                    yield {"event": "progress", "data": json.dumps(data)}
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": ""}
        finally:
            progress_subscribers.remove(q)

    return EventSourceResponse(event_generator())




@app.get("/api/transcript/{file_id}")
def get_transcript(file_id: int):
    db = get_db()
    row = db.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(status_code=404, detail="File not found")

    file = dict(row)
    stem = Path(file["filename"]).stem
    txt_path = os.path.join(OUTPUT_DIR, f"{stem}.txt")
    if not os.path.exists(txt_path):
        raise HTTPException(status_code=404, detail="Transcript not found")

    with open(txt_path, "r", encoding="utf-8") as f:
        text = f.read()
    return {"filename": file["filename"], "text": text, "word_count": len(text.split())}


