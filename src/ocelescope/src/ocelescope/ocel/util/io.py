from __future__ import annotations

import json
import xml.dom.minidom
from pathlib import Path


def pretty_print_json(path: Path) -> None:
    """Re-write a JSON file with 2-space indentation."""
    data = json.loads(path.read_text(encoding="utf-8"))
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def pretty_print_xml(path: Path) -> None:
    """Re-write an XML file with 2-space indentation."""
    raw = path.read_bytes()
    dom = xml.dom.minidom.parseString(raw)
    pretty = dom.toprettyxml(indent="  ")
    # minidom prepends a redundant <?xml?> declaration and inserts blank lines
    lines = [line for line in pretty.splitlines() if line.strip()]
    path.write_text("\n".join(lines), encoding="utf-8")
