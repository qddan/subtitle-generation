---
description: Review code for performance issues and optimization opportunities
---

# Performance Review

1. Check if Whisper model is loaded once and cached, or re-loaded per request
2. Review database connection handling - ensure connections are properly closed
3. Check for N+1 query patterns in list endpoints
4. Review file I/O operations for unnecessary reads/writes
5. Check SSE (Server-Sent Events) for memory leaks in subscriber list
6. Verify async/await usage is correct - no blocking calls in async endpoints
7. Review frontend re-renders - check useEffect dependencies and memoization
