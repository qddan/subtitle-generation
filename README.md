# Video2Text — AI Video Transcription

> Convert video MP4 to text transcripts using **Whisper AI**, with Vietnamese correction dictionary and batch processing.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-teal.svg)

---

## Screenshots

| Dashboard                            | Files                         |
| ------------------------------------ | ----------------------------- |
| Upload video, xem progress real-time | Quản lý files, xem transcript |

---

## Features

- **Video → Text**: Chuyển video MP4 thành file text bằng AI Whisper
- **Vietnamese Corrections**: Tự động sửa lỗi phiên âm tiếng Việt
- **Batch Processing**: Xử lý hàng loạt với progress bar real-time
- **Upload MP4**: Chọn file hoặc folder từ máy tính
- **Live Progress**: Xem % tiến trình qua SSE (Server-Sent Events)
- **Dark/Light Mode**: Giao diện tối/sáng tự động theo hệ thống
- **Download Transcript**: Xem và tải file text đã chuyển đổi

---

## Tech Stack

| Layer         | Technology                                   |
| ------------- | -------------------------------------------- |
| **Frontend**  | Next.js 15, React 19, TailwindCSS, shadcn/ui |
| **Backend**   | FastAPI, Python 3.11+, SQLite                |
| **AI Model**  | faster-whisper (OpenAI Whisper)              |
| **Real-time** | Server-Sent Events (SSE)                     |

---

## Project Structure

```
video2text/
├── backend/            # FastAPI backend
│   ├── main.py         # API server (endpoints)
│   ├── transcribe.py   # Whisper transcription + progress
│   ├── corrections.py  # Vietnamese correction dictionary
│   └── requirements.txt
├── frontend/           # Next.js 15 frontend
│   ├── src/
│   │   ├── app/        # Pages (dashboard, files)
│   │   ├── components/ # UI components (sidebar, header, ui/)
│   │   └── lib/        # Utilities
│   └── package.json
├── .env.example        # Environment config template
├── .github/workflows/  # CI/CD
└── README.md
```

---

## Quick Start

### 1. Clone repo

```bash
git clone https://github.com/YOUR_USERNAME/video2text.git
cd video2text
```

### 2. Backend Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate   # macOS/Linux
# venv\Scripts\activate    # Windows

# Install dependencies
cd backend
pip install -r requirements.txt

# Install ffmpeg (required for video processing)
# macOS:
brew install ffmpeg
# Ubuntu:
# sudo apt install ffmpeg

# Copy environment config
cp ../.env.example ../.env

# Start server
python -m uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Open app

Open http://localhost:3000

---

## Usage Guide

### Step 1: Thêm video

- **Chọn file**: Click "Chọn Video MP4" → chọn 1 hoặc nhiều file MP4
- **Thêm folder**: Nhập đường dẫn folder → click "Thêm Folder" (tự động scan cả subfolder)

### Step 2: Chuyển đổi

- Click **"Process All Files"** trên Dashboard
- Xem tiến trình real-time trên progress bar
- Live log hiển thị chi tiết từng bước

### Step 3: Xem kết quả

- Vào trang **Files** để xem danh sách file
- Click **"View"** để đọc transcript
- File text được lưu tại `backend/transcripts/`

### Step 4: Sử dụng transcript

- Copy text từ dialog hoặc lấy file từ thư mục `backend/transcripts/`
- Import vào **NotebookLM**, **Google Docs**, hoặc bất kỳ tool nào

---

## Environment Variables

| Variable        | Default         | Description                                               |
| --------------- | --------------- | --------------------------------------------------------- |
| `LOCAL_FOLDER`  | `.`             | Folder scan mặc định                                      |
| `OUTPUT_DIR`    | `./transcripts` | Thư mục lưu transcript                                    |
| `WHISPER_MODEL` | `small`         | Model Whisper: `tiny`, `base`, `small`, `medium`, `large` |
| `LANGUAGE`      | `vi`            | Ngôn ngữ: `vi` (Việt), `en` (English), etc.               |

---

## API Endpoints

| Method | Endpoint               | Description                             |
| ------ | ---------------------- | --------------------------------------- |
| `POST` | `/api/upload-files`    | Upload MP4/TXT files                    |
| `POST` | `/api/add-folder`      | Add files from local folder (recursive) |
| `GET`  | `/api/files`           | List all files                          |
| `GET`  | `/api/stats`           | Get processing stats                    |
| `POST` | `/api/process/{id}`    | Process single file                     |
| `POST` | `/api/process/all`     | Process all pending files               |
| `GET`  | `/api/transcript/{id}` | Get transcript text                     |
| `GET`  | `/api/progress`        | SSE progress stream                     |

---

## Deploy (Free)

### Frontend → Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → Import repo
3. Set root directory: `frontend`
4. Deploy

### Backend → Render

1. Go to [render.com](https://render.com) → New Web Service
2. Connect GitHub repo, root directory: `backend`
3. Build: `pip install -r requirements.txt`
4. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`

---

## Development

```bash
# Terminal 1: Backend
cd backend && source ../venv/bin/activate && uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend && npm run dev
```

---

## License

MIT
