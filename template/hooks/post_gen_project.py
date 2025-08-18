#!/usr/bin/env python
from pathlib import Path

# Cookiecutter renders this variable into the script before running
include_example = "{{ cookiecutter.include_example_extension|lower }}"

# Build the path to the example extension
example_file = Path("src") / "plugin" / "extensions" / "example.py"

if include_example != "y":
    if example_file.exists():
        example_file.unlink()
        print(f"🗑️ Removed example extension: {example_file}")
