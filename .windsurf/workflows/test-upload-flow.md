---
description: Test the complete file upload and transcription flow
---

# Test Upload Flow

1. Start backend server
```bash
cd backend && source ../venv314/bin/activate && python -m uvicorn main:app --reload --port 8000
```

2. Start frontend server
```bash
cd frontend && npm run dev
```

3. Open http://localhost:3000 in browser

4. Test file upload:
   - Click "Chọn Video MP4" button
   - Select one or more .mp4 files
   - Verify files appear in Stats (Total Files count increases)
   - Verify toast notification shows success

5. Test folder add:
   - Enter a folder path containing MP4 files
   - Click "Thêm Folder"
   - Verify files are added (check Stats)

6. Test transcription:
   - Click "Process All Files"
   - Verify progress bar appears with percentage
   - Verify live log shows progress messages
   - Verify Stats update when done (Done count increases)

7. Test view transcript:
   - Go to Files page
   - Click "View" on a completed file
   - Verify transcript dialog shows text content
