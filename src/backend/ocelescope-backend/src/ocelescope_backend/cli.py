import json
import sys
from pathlib import Path

from uvicorn.main import main as uvicorn_main

from ocelescope_backend.factory import create_app


def openapi(path: str) -> None:
    output_dir = Path(path)
    output_dir.mkdir(parents=True, exist_ok=True)

    openapi_path = output_dir / "openapi.json"
    fastapi_app = create_app()

    with open(openapi_path, "w") as f:
        json.dump(fastapi_app.openapi(), f, indent=2)

    print(f"OpenAPI written to {openapi_path}")


def serve(args: list[str]) -> None:
    extra_args = list(args)

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


def main() -> None:
    args = sys.argv[1:]

    if args and args[0] == "openapi":
        if len(args) != 2:
            print("Usage: ocelescope-backend openapi <output-dir>")
            raise SystemExit(2)

        openapi(args[1])
        return

    serve(args)


if __name__ == "__main__":
    main()
