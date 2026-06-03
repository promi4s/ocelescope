import json
import tomllib
from pathlib import Path


def generate_environment_list() -> list[str]:
    pyproject_path = Path("src") / "ocelescope" / "pyproject.toml"

    with pyproject_path.open("rb") as f:
        data = tomllib.load(f)

    project = data.get("project", {})
    dependencies = project.get("dependencies", [])
    optional_dependencies = project.get("optional-dependencies", {})
    plugin_dependencies = optional_dependencies.get("plugin", [])

    return sorted(dependencies + plugin_dependencies)


def generate_freeze_list() -> list[str]:
    freeze = Path("docs") / "data" / "pluginEnviroment.txt"

    return sorted(
        line.strip() for line in freeze.read_text().splitlines() if line.strip()
    )


def generate_plugins():
    json_file = Path("docs/data/plugins.json")
    plugins = json.loads(json_file.read_text(encoding="utf-8"))

    return plugins


def define_env(env):
    env.variables["env_list"] = generate_environment_list()
    env.variables["freeze_list"] = generate_freeze_list()
    env.variables["plugins"] = generate_plugins()
