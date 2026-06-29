# ocelescope

General tools and building blocks for working with
[Object-Centric Event Logs (OCEL)](https://www.ocel-standard.org/) and for
building plugins for the [Ocelescope](https://github.com/promi4s/ocelescope)
framework.

## Installation

```bash
pip install ocelescope
```

To also install the optional dependencies used by plugins:

```bash
pip install "ocelescope[plugin]"
```

## Usage

### Loading an OCEL

`OCEL.read` loads an OCEL 2.0 log from a `.sqlite`, `.xml` or `.json` file:

```python
from ocelescope import OCEL

ocel = OCEL.read("order-management.sqlite")

# Structured access to the log via managers (each exposes a pandas DataFrame):
print(ocel.events.df.head())
print(ocel.objects.df.head())
print(ocel.e2o.df.head())   # event-to-object relations
print(ocel.o2o.df.head())   # object-to-object relations
```

### Filtering

`OCEL.filter` applies a pipeline of filters and returns a new, filtered `OCEL`:

```python
from ocelescope import OCEL, EventTypeFilter, ObjectTypeFilter

ocel = OCEL.read("order-management.sqlite")

filtered = ocel.filter(
    [
        EventTypeFilter(event_types=["place order", "pay order"], mode="include"),
        ObjectTypeFilter(object_types=["items"], mode="exclude"),
    ]
)

filtered.write("filtered.sqlite")
```

### Command line

The package also ships an `ocelescope` command-line entry point:

```bash
ocelescope --help
```

## Typing

This package is fully type-hinted and ships a [PEP 561](https://peps.python.org/pep-0561/)
`py.typed` marker, so type checkers such as mypy, pyright and ty pick up its
types automatically — no extra stubs required.

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs developed at the Chair of Process and
Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
