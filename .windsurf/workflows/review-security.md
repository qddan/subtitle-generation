---
description: Review code for security vulnerabilities
---

# Security Review

1. Check all API endpoints for input validation and sanitization
2. Review CORS configuration in `backend/main.py` - ensure origins are restricted
3. Check for path traversal vulnerabilities in file upload/folder endpoints
4. Verify no secrets or API keys are hardcoded (check `.env`, `.gitignore`)
5. Review file upload limits and allowed file types
6. Check for SQL injection in database queries (parameterized queries)
7. Ensure error messages don't leak internal paths or stack traces
