# ocelescope-module-ocelot

The backend module for **Ocelot** — a tool for exploring object-centric event
logs, allowing you to search events and objects and visualize their
relationships and attributes.

This package provides the FastAPI routes consumed by the
[`@ocelescope/ocelot`](https://www.npmjs.com/package/@ocelescope/ocelot)
frontend module.

## Installation

```bash
pip install ocelescope-module-ocelot
```

The module registers itself with the host through the
`ocelescope_backend.modules` entry point and is discovered automatically once
[`ocelescope-backend`](../../ocelescope-backend) is running.

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs developed at the Chair of Process and
Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
