# @ocelescope/api-config

Shared [Orval](https://orval.dev/) configuration utilities for generating
Ocelescope API clients consistently across packages and modules.

## Installation

```bash
pnpm add -D @ocelescope/api-config
```

## Usage

```ts
// orval.config.ts
import { defineConfig } from "@ocelescope/api-config";

export default defineConfig({
  base: {
    output: { target: "./src/api/base.ts" },
  },
});
```

`defineConfig` applies Ocelescope's shared Orval defaults so every package and
module generates the same kind of client: a `react-query` client over `axios`,
reading from `./openapi.json`, with a sensible default query `staleTime`. You
only need to provide the per-client overrides (e.g. the output `target`).

### Use the fetcher from `@ocelescope/api-client`

`defineConfig` wires the Orval `mutator` to a local `./src/lib/fetcher.ts`
(exporting `customFetch`). That file **must re-export the `customFetch` fetcher
from [`@ocelescope/api-client`](https://www.npmjs.com/package/@ocelescope/api-client)**,
so the generated client shares the common session-id handling and base
configuration with the rest of the app:

```ts
// src/lib/fetcher.ts — used by the generated API client
import { customFetch as fetch } from "@ocelescope/api-client";
import type { AxiosRequestConfig } from "axios";

export const customFetch = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => fetch<T>(config, options);
```

If you need a different mutator location, override `output.override.mutator`,
but keep using `customFetch` from `@ocelescope/api-client` as the underlying
fetcher.

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs (OCEL) developed at the Chair of Process
and Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
