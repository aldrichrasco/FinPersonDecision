"""
Minimal in-memory rate limiter — no Redis, no external dependency.

Good enough for a single-process deployment or low traffic. If you scale
to multiple workers/instances, move this to Redis (the interface is small:
one `allow(key, limit, window)` call) so limits are shared across processes.
"""

import time
from collections import defaultdict, deque
from functools import wraps

from flask import request, jsonify

_HITS = defaultdict(deque)  # key -> deque[timestamps]


def _client_key(scope):
    # Prefer the real client IP behind Render's proxy.
    fwd = request.headers.get("X-Forwarded-For", "")
    ip = fwd.split(",")[0].strip() if fwd else request.remote_addr or "unknown"
    return f"{scope}:{ip}"


def allow(key, limit, window):
    now = time.time()
    q = _HITS[key]
    cutoff = now - window
    while q and q[0] < cutoff:
        q.popleft()
    if len(q) >= limit:
        return False
    q.append(now)
    return True


def rate_limit(limit, window, scope=None):
    """Decorator: at most `limit` requests per `window` seconds per client IP."""
    def decorator(fn):
        tag = scope or fn.__name__

        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = _client_key(tag)
            if not allow(key, limit, window):
                resp = jsonify({"error": "rate limit exceeded, slow down"})
                resp.status_code = 429
                resp.headers["Retry-After"] = str(window)
                return resp
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def prune(max_age=3600):
    """Occasionally drop stale buckets so memory doesn't grow unbounded."""
    now = time.time()
    for key in list(_HITS.keys()):
        q = _HITS[key]
        while q and q[0] < now - max_age:
            q.popleft()
        if not q:
            del _HITS[key]
