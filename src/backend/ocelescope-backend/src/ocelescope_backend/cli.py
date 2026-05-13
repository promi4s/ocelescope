import uvicorn


def main() -> None:
    uvicorn.run(
        "ocelescope_backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
