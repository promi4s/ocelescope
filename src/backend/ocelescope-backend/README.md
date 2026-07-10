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
