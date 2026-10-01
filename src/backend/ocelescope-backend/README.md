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

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs developed at the Chair of Process and
Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>

## OCEL extensions

A module publishes its extension classes with `extensions = [SOCEL]`, alongside
its existing `resources` declaration. Each class inherits `OCELExtension` and
provides `id`, `label`, and `from_ocel(ocel)`.

The application calls `from_ocel` on the active, read-only log to recognize it.
Return an extension when supported; raise any exception when unsupported. A log
is recognized once per view, so the result is reused until its filters change.
Keep this method free of writes, and leave the supplied OCEL open: its lifetime
belongs to the caller. An extension that accepts every OCEL will be listed for
every OCEL.

To receive a typed extension in a FastAPI endpoint:

```python
from typing import Annotated
from fastapi import Depends
from ocelescope_backend.app.dependencies import get_ocel_extension
from my_module.extensions import SOCEL

ApiSOCEL = Annotated[SOCEL, Depends(get_ocel_extension(SOCEL))]


@router.get("/locations")
def locations(log: ApiSOCEL):
    return log.locations.list()
```

The dependency shares `ApiOcel`'s connection, `ocel_id`, `ocel_version`, and request
cleanup. Unsupported logs return HTTP 422. It can also be used in a router's
`dependencies` list. Frontend guards supplement this backend check.

The OCEL metadata endpoints include an `extensions` array of matching `{id,
label}` pairs. These drive the badges in the management list and log overview.
Recognition uses the imported contents, regardless of the JSON or SQLite filename.
