import sys

from uvicorn.main import main as uvicorn_main


def main() -> None:
    extra_args = sys.argv[1:]

    if "--host" not in extra_args:
        extra_args = ["--host", "0.0.0.0", *extra_args]

    if "--port" not in extra_args:
        extra_args = ["--port", "8000", *extra_args]

    sys.argv = [
        "uvicorn",
        "ocelescope_backend.main:app",
        *extra_args,
    ]
    uvicorn_main()
