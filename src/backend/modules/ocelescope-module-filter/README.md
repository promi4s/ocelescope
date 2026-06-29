# ocelescope-module-filter

The backend module providing basic filtering functionality for object-centric
event logs in Ocelescope.

This package provides the FastAPI routes consumed by the
[`@ocelescope/filter`](https://www.npmjs.com/package/@ocelescope/filter)
frontend module.

## Installation

```bash
pip install ocelescope-module-filter
```

The module registers itself with the host through the
`ocelescope_backend.modules` entry point and is discovered automatically once
[`ocelescope-backend`](../../ocelescope-backend) is running.

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs developed at the Chair of Process and
Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
