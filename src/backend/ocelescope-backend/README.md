# ocelescope-backend

The Ocelescope backend host application. It exposes the FastAPI server that
serves OCELs, resources and modules, and provides the `ocelescope-backend`
command-line interface.

## Installation

```bash
pip install ocelescope-backend
```

## Usage

Start the development server:

```bash
ocelescope-backend serve
```

Other commands (e.g. generating an OpenAPI schema for a module) are available
via:

```bash
ocelescope-backend --help
```

## Modules

The backend discovers modules through the `ocelescope_backend.modules` entry
point group. Installing a module package (for example
[`ocelescope-module-ocelot`](../modules/ocelescope-module-ocelot)) makes it
available to the host automatically.

## OCEL extensions

A format that extends OCEL, such as QEL, is a subclass of `OCEL` with an
`extension` declaring the tables it adds.

```python
class SocelModule(Module):
    meta = ModuleMeta(key="socel", version=Version("1.0"))
    extensions = [SOCEL]  # formats this module knows
```

`extensions` lists the formats a module knows. A log that has a format's tables
is reported with its name and label in the OCEL metadata (`extensions`); the
frontend shows the labels and uses the names to guard pages (`requiresOcel`).

A route gets the log as the subclass with `ocel_as`, the equivalent of `ApiOcel`:

```python
from ocelescope_backend.app.dependencies import ocel_as

ApiSOCEL = Annotated[SOCEL, Depends(ocel_as(SOCEL))]


@router.get("/{ocel_id}/flows")
def flows(socel: ApiSOCEL):
    return socel.flows.table.df().to_dict("records")
```

It takes the same `ocel_id` and `ocel_version` as `ApiOcel`. A log that is not of
the format is answered with HTTP 422.

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs developed at the Chair of Process and
Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
