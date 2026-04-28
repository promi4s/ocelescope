# Extensions

OCEL extensions let you store and load **extra data** that is not part of the OCEL 2.0 standard.

Use an extension when your plugin needs custom information to travel with the log (import/export), instead of keeping it in a separate side file.

## Defining an OCEL extension

Create a class that inherits from `OCELExtension`.

Your extension should:

- describe itself (`name`, `description`, `version`)
- declare which file types it supports (`supported_extensions`)
- implement:
  - `has_extension(path: Path) -> bool` to detect if the file contains the extension data
  - `import_extension(ocel: OCEL, path: Path) -> OCELExtension` to load the extension data
  - `export_extension(path: Path) -> None` to save the extension data

Ocelescope loads and exports extensions based on the OCEL file path suffix (for example `.json`, `.xml`, or `.sqlite`).

!!! example

    This extension stores a message inside a `.json` OCEL file under a custom field called `hello_message`.

    ```python
    import json
    from pathlib import Path

    from ocelescope import OCEL, OCELExtension


    class HelloWorldExtension(OCELExtension):
        name = "HelloWorld"
        description = "Stores a message string in the .json OCEL file"
        version = "1.0"
        supported_extensions = [".json"]

        def __init__(self, ocel: OCEL, message: str):
            self.ocel = ocel
            self.message = message

        @staticmethod
        def has_extension(path: Path) -> bool:
            if path.suffix != ".json":
                return False

            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                return False

            return "hello_message" in data

        @classmethod
        def import_extension(cls, ocel: OCEL, path: Path) -> "HelloWorldExtension":
            data = json.loads(path.read_text(encoding="utf-8"))
            return cls(ocel=ocel, message=str(data.get("hello_message", "")))

        def export_extension(self, path: Path) -> None:
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                data = {}

            data["hello_message"] = self.message
            path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    ```

## Requiring an extension in a plugin method

If your method depends on an extension being present, declare it on the OCEL input with `OCELAnnotation`.

Pass the **extension class** (not an instance).

```python
from typing import Annotated

from ocelescope import OCEL, OCELAnnotation, Plugin, plugin_method


class ExamplePlugin(Plugin):
    @plugin_method(label="Uses extension")
    def uses_extension(
        self,
        ocel: Annotated[OCEL, OCELAnnotation(label="log", extension=HelloWorldExtension)],
    ):
      
      extension = ocel.extensions.get(HelloWorldExtension)  
      if extension is not None:
          print(extension.message)

      ...
```
