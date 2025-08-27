# Extensions

In some use cases, OCEL logs contain more information than is specified in the OCEL 2.0 standard.  
To support these cases in a standardized and portable way, Ocelescope provides **OCEL extensions**.

Extensions allow you to add custom data to OCEL logs and store or load that data alongside the main event and object logs.

## Defining an OCEL Extension

To define an extension, create a class that inherits from `OCELExtension` (provided by the `ocelescope` package).  
This class defines how the extension is detected, imported, and exported.

Each extension must define the following attributes and methods:

- `name`: A short identifier for the extension
- `description`: A human-readable explanation of what the extension adds
- `version`: The extension’s version
- `supported_extensions`: A list of file types the extension supports (e.g., `[".xmlocel"]`)

The class must also implement three key methods:

- `has_extension(path: Path) -> bool`  
  Checks if the extension is present at the given file path

- `import_extension(ocel: OCEL, path: Path) -> OCELExtension`  
  Loads the extension data from the path and returns an instance

- `export_extension(path: Path) -> None`  
  Saves the extension data to the path

## Base Class: `OCELExtension`

```python
from abc import ABC, abstractmethod
from pathlib import Path
from typing import TypeVar

from ocelescope.ocel.constants import OCELFileExtensions

T = TypeVar("T", bound="OCELExtension")

class OCELExtension(ABC):
    """
    Abstract base class for OCEL extensions that can be imported/exported from a file path.
    """

    name: str
    description: str
    version: str
    supported_extensions: list[OCELFileExtensions]

    @staticmethod
    @abstractmethod
    def has_extension(path: Path) -> bool:
        pass

    @classmethod
    @abstractmethod
    def import_extension(cls: type[T], ocel: "OCEL", path: Path) -> T:
        pass

    @abstractmethod
    def export_extension(self, path: Path) -> None:
        pass
```

## Example: “Hello World” Extension

This version of the `HelloWorldExtension` stores a message directly inside the `.jsonocel` file under a custom top-level field like `"hello_message"`.
It only loads if that field is present.

```python
import json
from pathlib import Path
from ocelescope import OCEL, OCELExtension

class HelloWorldExtension(OCELExtension):
    name = "HelloWorld"
    description = "Stores a simple message string in the .jsonocel file"
    version = "1.0"
    supported_extensions = [".jsonocel"]

    def __init__(self, ocel: OCEL, message: str = "Hello from extension!"):
        self.ocel = ocel
        self.message = message

    @staticmethod
    def has_extension(path: Path) -> bool:
        if path.suffix != ".jsonocel":
            return False

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return "hello_message" in data
        except Exception:
            return False

    @classmethod
    def import_extension(cls, ocel: OCEL, path: Path) -> "HelloWorldExtension":
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        message = data.get("hello_message", "No message found.")
        return cls(ocel, message=message)

    def export_extension(self, path: Path) -> None:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {}

        data["hello_message"] = self.message

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
```
