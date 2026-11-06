"""Transport-level request limits.

The API is unauthenticated by design (see SECURITY.md), so every byte a caller sends is
attacker-controlled, and neither uvicorn nor Starlette caps a request body on its own. The
only trusted decision point that still sees the body before it is buffered and parsed is a
middleware in front of the app, which is what this module provides.
"""

from __future__ import annotations

import json
import os
from typing import Any, Awaitable, Callable, MutableMapping

# Default cap for every request body. The largest documented request is a 200,000-character
# `/api/entities-long` document plus its labels (roughly 201 KB of JSON), so 1 MB leaves room
# for the documented surface while still bounding what one caller can make the process buffer.
DEFAULT_MAX_REQUEST_BYTES = 1_000_000

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
ASGIApp = Callable[
    [Scope, Callable[[], Awaitable[Message]], Callable[[Message], Awaitable[None]]], Awaitable[None]
]


def max_request_bytes() -> int:
    """Body cap from `GLINER_MAX_REQUEST_BYTES`, falling back to the default."""
    raw = os.environ.get("GLINER_MAX_REQUEST_BYTES")
    if not raw:
        return DEFAULT_MAX_REQUEST_BYTES
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_MAX_REQUEST_BYTES
    return value if value > 0 else DEFAULT_MAX_REQUEST_BYTES


class RequestSizeLimitMiddleware:
    """Reject oversized request bodies with 413 before they are buffered.

    A declared `Content-Length` over the limit is refused without reading the body. A body
    sent without one (chunked transfer) is read up to the limit, refused if it crosses, and
    otherwise replayed to the app unchanged. The limit is resolved per request, so
    `GLINER_MAX_REQUEST_BYTES` can change without rebuilding the app.
    """

    def __init__(self, app: ASGIApp, limit: int | None = None) -> None:
        self.app = app
        self._limit = limit

    async def __call__(
        self,
        scope: Scope,
        receive: Callable[[], Awaitable[Message]],
        send: Callable[[Message], Awaitable[None]],
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        limit = self._limit or max_request_bytes()
        declared = _content_length(scope)
        if declared is not None:
            if declared > limit:
                await _reject(send, limit)
                return
            await self.app(scope, receive, send)
            return

        body = b""
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body += message.get("body", b"")
            if len(body) > limit:
                await _reject(send, limit)
                return
            if not message.get("more_body", False):
                break

        replayed = False

        async def replay() -> Message:
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return {"type": "http.disconnect"}

        await self.app(scope, replay, send)


def _content_length(scope: Scope) -> int | None:
    for name, value in scope.get("headers", []):
        if name == b"content-length":
            try:
                return int(value)
            except ValueError:
                return None
    return None


async def _reject(send: Callable[[Message], Awaitable[None]], limit: int) -> None:
    body = json.dumps({"detail": f"Request body exceeds the {limit}-byte limit"}).encode()
    await send({
        "type": "http.response.start",
        "status": 413,
        "headers": [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode()),
        ],
    })
    await send({"type": "http.response.body", "body": body})
