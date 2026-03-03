# Changelog

## [1.0.0] - 2025-01-20

### Added
- **Video transcription** — Upload MP4 videos and convert to text using Whisper AI
- **Real-time progress** — SSE-based progress bar with percentage during transcription
- **Folder scanning** — Add entire folders (recursive) to scan for video files
- **File upload** — Drag-and-drop or click to upload MP4/TXT files
- **Transcript viewer** — View completed transcripts in a modal dialog
- **Dashboard** — Stats overview with total, pending, done, error counts
- **Dark/Light mode** — Toggle between themes
- **Vietnamese corrections** — Auto-correct common Whisper transcription errors for Vietnamese
- **Repetition removal** — Clean up repeated sentences in transcripts

### Backend
- FastAPI REST API with SQLite database
- Endpoints: upload, add-folder, process, process-all, stats, files, transcript, progress (SSE)
- Environment variable configuration via `.env`
- CORS with configurable allowed origins
- File size limits and path traversal protection

### Frontend
- Next.js 15 with React 19, TailwindCSS, shadcn/ui
- Responsive sidebar layout with Dashboard and Files pages
- Real-time progress bar with gradient animation
- Toast notifications for all operations
- Skeleton loading states

### DevOps
- GitHub Actions CI/CD (backend tests + frontend build)
- Render deployment config (`render.yaml`)
- Vercel deployment config (`vercel.json`)
- Comprehensive API test suite (19 tests)
- Electron desktop app for macOS

### Security
- Input sanitization on file uploads (path traversal prevention)
- Configurable CORS origins via environment variables
- File size limits on uploads
- No hardcoded secrets
