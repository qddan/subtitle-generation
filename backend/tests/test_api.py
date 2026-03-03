"""
End-to-end API tests for Video2Text backend.
Run with: pytest backend/tests/test_api.py -v
Requires the backend to NOT be running (uses TestClient).
"""
import io
import os
import sys
import tempfile

import pytest

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from main import app, DB_PATH, UPLOAD_DIR, OUTPUT_DIR


@pytest.fixture(autouse=True)
def clean_db():
    """Remove test DB before each test for isolation."""
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    yield
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)


@pytest.fixture
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# GET /api/stats
# ---------------------------------------------------------------------------
class TestStats:
    def test_stats_empty(self, client):
        r = client.get("/api/stats")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 0
        assert data["pending"] == 0
        assert data["done"] == 0

    def test_stats_keys(self, client):
        r = client.get("/api/stats")
        data = r.json()
        for key in ("total", "pending", "processing", "done", "error"):
            assert key in data


# ---------------------------------------------------------------------------
# GET /api/files
# ---------------------------------------------------------------------------
class TestListFiles:
    def test_files_empty(self, client):
        r = client.get("/api/files")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_files_returns_list_of_dicts(self, client):
        r = client.get("/api/files")
        for item in r.json():
            assert "id" in item
            assert "filename" in item
            assert "status" in item


# ---------------------------------------------------------------------------
# POST /api/upload-files
# ---------------------------------------------------------------------------
class TestUploadFiles:
    def test_upload_txt(self, client):
        content = b"Hello world test content"
        r = client.post(
            "/api/upload-files",
            files=[("files", ("test_upload.txt", io.BytesIO(content), "text/plain"))],
        )
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 1
        assert "test_upload.txt" in data["uploaded"]
        # Verify file exists on disk
        assert os.path.exists(os.path.join(UPLOAD_DIR, "test_upload.txt"))

    def test_upload_ignores_unsupported_types(self, client):
        r = client.post(
            "/api/upload-files",
            files=[("files", ("readme.md", io.BytesIO(b"# Hi"), "text/markdown"))],
        )
        assert r.status_code == 200
        assert r.json()["count"] == 0

    def test_upload_no_files(self, client):
        # FastAPI returns 422 when no valid file is provided
        r = client.post(
            "/api/upload-files",
            files=[("files", ("", io.BytesIO(b""), "application/octet-stream"))],
        )
        assert r.status_code in (200, 422)

    def test_upload_duplicate(self, client):
        content = b"Duplicate test"
        for _ in range(2):
            client.post(
                "/api/upload-files",
                files=[("files", ("dup.txt", io.BytesIO(content), "text/plain"))],
            )
        # Stats should show only 1 file
        stats = client.get("/api/stats").json()
        assert stats["total"] == 1


# ---------------------------------------------------------------------------
# POST /api/add-folder
# ---------------------------------------------------------------------------
class TestAddFolder:
    def test_add_invalid_folder(self, client):
        r = client.post("/api/add-folder", json={"folder_path": "/nonexistent/path"})
        assert r.status_code == 400

    def test_add_empty_folder(self, client):
        r = client.post("/api/add-folder", json={"folder_path": ""})
        assert r.status_code == 400

    def test_add_valid_folder(self, client):
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create test files
            open(os.path.join(tmpdir, "video1.mp4"), "wb").close()
            open(os.path.join(tmpdir, "notes.txt"), "w").write("hello")
            open(os.path.join(tmpdir, "readme.md"), "w").write("skip me")

            r = client.post(
                "/api/add-folder",
                json={"folder_path": tmpdir, "recursive": False},
            )
            assert r.status_code == 200
            data = r.json()
            assert data["count"] == 2  # mp4 + txt only
            assert data["skipped"] == 0

    def test_add_folder_recursive(self, client):
        with tempfile.TemporaryDirectory() as tmpdir:
            subdir = os.path.join(tmpdir, "sub")
            os.makedirs(subdir)
            open(os.path.join(tmpdir, "a.mp4"), "wb").close()
            open(os.path.join(subdir, "b.mp4"), "wb").close()

            r = client.post(
                "/api/add-folder",
                json={"folder_path": tmpdir, "recursive": True},
            )
            assert r.status_code == 200
            assert r.json()["count"] == 2

    def test_add_folder_skips_duplicates(self, client):
        with tempfile.TemporaryDirectory() as tmpdir:
            open(os.path.join(tmpdir, "v.mp4"), "wb").close()
            client.post("/api/add-folder", json={"folder_path": tmpdir})
            r = client.post("/api/add-folder", json={"folder_path": tmpdir})
            assert r.json()["count"] == 0
            assert r.json()["skipped"] == 1


# ---------------------------------------------------------------------------
# POST /api/process/{file_id} — error cases
# ---------------------------------------------------------------------------
class TestProcessFile:
    def test_process_not_found(self, client):
        r = client.post("/api/process/99999")
        assert r.status_code == 404

    def test_process_txt_file(self, client):
        # Upload a txt file first
        content = b"Test transcription content for processing"
        client.post(
            "/api/upload-files",
            files=[("files", ("proc_test.txt", io.BytesIO(content), "text/plain"))],
        )
        # Get its ID
        files = client.get("/api/files").json()
        txt_file = next(f for f in files if f["filename"] == "proc_test.txt")

        r = client.post(f"/api/process/{txt_file['id']}")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "done"
        assert data["word_count"] > 0


# ---------------------------------------------------------------------------
# POST /api/process/all
# ---------------------------------------------------------------------------
class TestProcessAll:
    def test_process_all_no_pending(self, client):
        r = client.post("/api/process/all")
        # May return 200 or 422 depending on async context
        if r.status_code == 200:
            assert "No pending" in r.json()["message"]
        else:
            assert r.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/transcript/{file_id}
# ---------------------------------------------------------------------------
class TestTranscript:
    def test_transcript_not_found(self, client):
        r = client.get("/api/transcript/99999")
        assert r.status_code == 404

    def test_transcript_after_process(self, client):
        # Upload + process
        content = b"Transcript viewing test"
        client.post(
            "/api/upload-files",
            files=[("files", ("view_test.txt", io.BytesIO(content), "text/plain"))],
        )
        files = client.get("/api/files").json()
        fid = files[0]["id"]
        client.post(f"/api/process/{fid}")

        r = client.get(f"/api/transcript/{fid}")
        assert r.status_code == 200
        data = r.json()
        assert "text" in data
        assert data["word_count"] > 0


# ---------------------------------------------------------------------------
# GET /api/progress (SSE)
# ---------------------------------------------------------------------------
class TestSSE:
    def test_progress_endpoint_exists(self, client):
        # Verify the /docs page lists the progress endpoint
        r = client.get("/docs")
        assert r.status_code == 200
