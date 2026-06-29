# @ocelescope/log-overview

The **Log Overview** module for [Ocelescope](https://github.com/promi4s/ocelescope).

A tool for inspecting object-centric event logs at a glance.

It is a frontend module that plugs into the Ocelescope app shell via
`@ocelescope/core`'s `defineModule`.

## Installation

```bash
pnpm add @ocelescope/log-overview
```

## Integration

Register the module in your `ocelescope.config.ts` by adding its default
export to the `modules` array:

```ts
// ocelescope.config.ts
import type { OcelescopeConfig } from "@ocelescope/core";
import logOverview from "@ocelescope/log-overview";

export default {
  modules: [logOverview],
} satisfies OcelescopeConfig;
```

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs (OCEL) developed at the Chair of Process
and Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
