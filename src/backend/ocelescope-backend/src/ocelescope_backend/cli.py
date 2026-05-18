from pathlib import Path
from typing import Annotated

import orjson
import typer
import uvicorn

from ocelescope_backend.app.modules.loader import discover_modules, get_module_path
from ocelescope_backend.factory import create_app

app = typer.Typer()


def join_openapi_path(prefix: str, route_path: str) -> str:
    prefix = prefix.strip("/")
    route_path = route_path.strip("/")

    if prefix and route_path:
        return f"/{prefix}/{route_path}"
    if prefix:
        return f"/{prefix}"
    if route_path:
        return f"/{route_path}"
    return "/"


@app.command("serve")
def serve(
    host: Annotated[str, typer.Option()] = "0.0.0.0",
    port: Annotated[int, typer.Option()] = 8000,
    reload: Annotated[bool, typer.Option("--reload")] = False,
    reload_dirs: Annotated[list[Path] | None, typer.Option("--reload-dir")] = None,
    env_file: Annotated[Path | None, typer.Option()] = None,
) -> None:
    uvicorn.run(
        "ocelescope_backend.main:app",
        host=host,
        port=port,
        reload=reload,
        reload_dirs=[str(dir) for dir in reload_dirs]
        if reload_dirs is not None
        else reload_dirs,
        timeout_graceful_shutdown=1 if reload else None,
        env_file=env_file,
    )


@app.command("openapi")
def generate_base_api(
    path: Annotated[Path, typer.Option()] = Path("openapi.json"),
    module: Annotated[str | None, typer.Option()] = None,
    version: Annotated[int | None, typer.Option()] = None,
) -> None:
    if module is not None:
        module_class = next(
            (
                candidate
                for candidate in discover_modules()
                if candidate.meta.key == module
                and (version is None or candidate.meta.version.major == version)
            ),
            None,
        )
        if module_class is None:
            raise typer.BadParameter(f"Unknown module: {module}")

        fastapi_app = module_class.create_app()
        prefix = get_module_path(module_class)

        openapi_schema = fastapi_app.openapi()
        openapi_schema["paths"] = {
            join_openapi_path(prefix, route_path): route_schema
            for route_path, route_schema in openapi_schema["paths"].items()
        }
    else:
        fastapi_app = create_app()
        openapi_schema = fastapi_app.openapi()

    path.write_bytes(orjson.dumps(openapi_schema, option=orjson.OPT_INDENT_2))
