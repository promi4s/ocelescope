# @ocelescope/api-client

The core client and session/hooks layer used by the Ocelescope API packages.
It exposes the shared `customFetch` fetcher, environment configuration and the
session store consumed by the generated API clients.

## Installation

```bash
pnpm add @ocelescope/api-client
```

## Usage

```ts
import { customFetch, env, useSessionStore } from "@ocelescope/api-client";
```

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs (OCEL) developed at the Chair of Process
and Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
