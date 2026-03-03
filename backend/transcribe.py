import os
import re
import subprocess
from pathlib import Path
from typing import Callable, Optional

from faster_whisper import WhisperModel

from corrections import CORRECTIONS


def apply_corrections(text: str) -> str:
    """Apply dictionary corrections to transcribed text."""
    for pattern, replacement in CORRECTIONS.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text


def remove_repetitions(text: str, max_repeat: int = 2) -> str:
    """Remove repeated sentences to clean up transcript."""
    sentences = text.replace(".", ".\n").split("\n")
    seen, result = {}, []
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        seen[s] = seen.get(s, 0) + 1
        if seen[s] <= max_repeat:
            result.append(s)
    return " ".join(result)


def get_video_duration(filepath: str) -> float:
    """Get video duration in seconds using ffprobe."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", filepath],
            capture_output=True,
            text=True,
        )
        return float(result.stdout.strip())
    except Exception:
        return 0


def transcribe_video(
    filepath: str,
    model_size: str = "small",
    language: str = "vi",
    output_dir: str = "./transcripts",
    progress_callback: Optional[Callable[[int, str], None]] = None,
) -> dict:
    """
    Transcribe a video file using faster-whisper, apply corrections,
    and save the result to a text file.

    Args:
        filepath: Path to video file
        model_size: Whisper model size (tiny, base, small, medium, large)
        language: Language code (vi, en, etc.)
        output_dir: Directory to save transcript
        progress_callback: Optional callback(percent, message) for progress updates

    Returns dict with keys: output_path, word_count, duration_sec, text
    """
    os.makedirs(output_dir, exist_ok=True)

    # Get video duration for progress calculation
    duration = get_video_duration(filepath)
    
    if progress_callback:
        progress_callback(5, f"Loading Whisper model ({model_size})...")

    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    if progress_callback:
        progress_callback(10, f"Transcribing... (duration: {duration:.0f}s)")

    # Transcribe with VAD filter for better accuracy
    segments, info = model.transcribe(
        filepath,
        language=language,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=1000, threshold=0.3),
        condition_on_previous_text=False,
        no_speech_threshold=0.8,
    )

    full_text_parts = []
    last_end = 0
    
    for segment in segments:
        full_text_parts.append(segment.text.strip())
        
        # Calculate progress based on segment position
        if duration > 0 and progress_callback:
            # Progress from 10% to 80% during transcription
            pct = 10 + int((segment.end / duration) * 70)
            pct = min(pct, 80)
            progress_callback(pct, f"Transcribing... {segment.end:.0f}s / {duration:.0f}s")
        
        last_end = segment.end

    raw_text = " ".join(full_text_parts)
    
    if progress_callback:
        progress_callback(85, "Removing repetitions...")
    
    # Remove repetitions
    cleaned_text = remove_repetitions(raw_text)
    
    if progress_callback:
        progress_callback(90, "Applying corrections...")
    
    # Apply corrections
    corrected_text = apply_corrections(cleaned_text)

    if progress_callback:
        progress_callback(95, "Saving transcript...")

    stem = Path(filepath).stem
    output_path = os.path.join(output_dir, f"{stem}.txt")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(corrected_text)

    word_count = len(corrected_text.split())
    duration_sec = round(info.duration, 2) if info.duration else round(duration, 2)

    if progress_callback:
        progress_callback(100, f"Done! {word_count} words")

    return {
        "output_path": output_path,
        "word_count": word_count,
        "duration_sec": duration_sec,
        "text": corrected_text,
    }
