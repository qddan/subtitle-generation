---
description: Test all backend API endpoints for correct behavior
---

# Test API Endpoints

Run these curl commands to verify each endpoint:

1. **Health check** - Backend is running
// turbo
```bash
curl -s http://localhost:8000/docs | head -5
```

2. **Stats** - Returns file counts
// turbo
```bash
curl -s http://localhost:8000/api/stats | python3 -m json.tool
```

3. **List files** - Scans folder and returns file list
// turbo
```bash
curl -s http://localhost:8000/api/files | python3 -m json.tool
```

4. **Upload file** - Upload an MP4 or TXT file
```bash
curl -s -X POST http://localhost:8000/api/upload-files -F "files=@test_sample.txt" | python3 -m json.tool
```

5. **Add folder** - Add files from a local folder
```bash
curl -s -X POST http://localhost:8000/api/add-folder -H "Content-Type: application/json" -d '{"folder_path": "/tmp", "recursive": false}' | python3 -m json.tool
```

6. **Process file** - Transcribe a specific file by ID
```bash
curl -s -X POST http://localhost:8000/api/process/1 | python3 -m json.tool
```

7. **Get transcript** - Read a completed transcript
```bash
curl -s http://localhost:8000/api/transcript/1 | python3 -m json.tool
```
