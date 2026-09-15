import os

import uvicorn

if __name__ == "__main__":
    # Loopback by default: the CORS allowlist is localhost-only and the API is
    # unauthenticated, so exposing it on the LAN is an explicit choice.
    uvicorn.run(
        "app.main:app",
        host=os.environ.get("GLINER_HOST", "127.0.0.1"),
        port=8000,
    )
