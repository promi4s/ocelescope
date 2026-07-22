"""Bump all workspace packages (pnpm + uv) to the same version in lockstep.

Usage: uv run scripts/bump_version.py patch|minor|major|X.Y.Z
"""

import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXCLUDED = {"node_modules", "dist", ".next", ".venv", ".git", "data"}

arg = sys.argv[1]
package_jsons = [p for p in ROOT.rglob("package.json") if not EXCLUDED & set(p.parts)]
pyprojects = [p for p in ROOT.rglob("pyproject.toml") if not EXCLUDED & set(p.parts)]
members = {tomllib.loads(p.read_text())["project"]["name"] for p in pyprojects}

current = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]["version"]
major, minor, patch = map(int, current.split("."))
new = {
    "major": f"{major + 1}.0.0",
    "minor": f"{major}.{minor + 1}.0",
    "patch": f"{major}.{minor}.{patch + 1}",
}.get(arg, arg)
major, minor, _ = map(int, new.split("."))
print(f"{current} -> {new}")

# "ocelescope-backend>=0.4.0,<0.5.0" -> ">=NEW,<NEXT_MINOR"; external deps untouched
names = "|".join(re.escape(n) for n in sorted(members, key=len, reverse=True))
dep_re = re.compile(rf'"({names})(\[[^\]]*\])?[<>=~!][^"]*"')

for path in package_jsons:
    if "version" in json.loads(text := path.read_text()):
        path.write_text(
            re.sub(r'"version": "[^"]+"', f'"version": "{new}"', text, count=1)
        )

for path in pyprojects:
    text = re.sub(
        r'^version = "[^"]+"',
        f'version = "{new}"',
        path.read_text(),
        count=1,
        flags=re.M,
    )
    path.write_text(dep_re.sub(rf'"\1\2>={new},<{major}.{minor + 1}.0"', text))

subprocess.run(["uv", "lock"], cwd=ROOT, check=True)
subprocess.run(["pnpm", "install"], cwd=ROOT, check=True)
