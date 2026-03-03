---
description: Test transcription accuracy and quality
---

# Test Transcription Quality

1. **Prepare test video** - Use a short MP4 file (< 1 min) with clear Vietnamese speech

2. **Run transcription via API**
```bash
curl -s -X POST http://localhost:8000/api/upload-files -F "files=@test_video.mp4" | python3 -m json.tool
curl -s -X POST http://localhost:8000/api/process/all | python3 -m json.tool
```

3. **Check output quality**
   - Read the generated transcript in `backend/transcripts/`
   - Verify Vietnamese text is readable
   - Verify corrections dictionary was applied (check for known corrections)
   - Verify repetitions were removed
   - Verify word count is reasonable for the video length

4. **Check VAD (Voice Activity Detection)**
   - Verify silent parts of video are not transcribed as noise
   - Verify no repeated hallucinated text appears

5. **Check progress reporting**
   - Monitor SSE events during transcription
   - Verify progress percentage increases from 0% to 100%
   - Verify messages show seconds progress (e.g., "Transcribing... 30s / 120s")

6. **Compare with direct Whisper output**
```bash
cd backend && source ../venv314/bin/activate
python -c "
from transcribe import transcribe_video
result = transcribe_video('uploads/test.mp4', progress_callback=lambda p, m: print(f'{p}% {m}'))
print(f'Words: {result[\"word_count\"]}, Duration: {result[\"duration_sec\"]}s')
"
```
