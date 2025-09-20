import json
from app import app as fast_app
from pathlib import Path


import typer

app = typer.Typer()


@app.command()
def openapi(path: str):
    openapi_path = Path(path) / "openapi.json"
    with open(openapi_path, "w") as f:
        json.dump(fast_app.openapi(), f, indent=2)


if __name__ == "__main__":
    app()
