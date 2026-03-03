---
description: Review code for proper error handling and edge cases
---

# Error Handling Review

1. Check all API endpoints have try/catch with proper HTTP status codes
2. Verify file-not-found and permission errors are handled gracefully
3. Review transcription error handling - what happens when Whisper fails mid-file
4. Check frontend error boundaries and toast notifications for all failure paths
5. Verify database transactions are rolled back on error
6. Check SSE connection error recovery on the frontend
7. Review edge cases: empty files, corrupted MP4, very large files, special characters in filenames
