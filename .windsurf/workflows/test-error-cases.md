---
description: Test error handling and edge cases
---

# Test Error Cases

1. **Invalid folder path**
// turbo
```bash
curl -s -X POST http://localhost:8000/api/add-folder -H "Content-Type: application/json" -d '{"folder_path": "/nonexistent/path"}' | python3 -m json.tool
```
Expected: 400 error with "Invalid folder path"

2. **Process non-existent file**
// turbo
```bash
curl -s -X POST http://localhost:8000/api/process/99999 | python3 -m json.tool
```
Expected: 404 error with "File not found"

3. **Get transcript for non-existent file**
// turbo
```bash
curl -s http://localhost:8000/api/transcript/99999 | python3 -m json.tool
```
Expected: 404 error

4. **Upload non-MP4 file** - Should be silently ignored
```bash
echo "test" > /tmp/test.pdf && curl -s -X POST http://localhost:8000/api/upload-files -F "files=@/tmp/test.pdf" | python3 -m json.tool
```
Expected: count = 0

5. **Empty folder** - No video files found
```bash
mkdir -p /tmp/empty_test && curl -s -X POST http://localhost:8000/api/add-folder -H "Content-Type: application/json" -d '{"folder_path": "/tmp/empty_test"}' | python3 -m json.tool
```
Expected: count = 0
