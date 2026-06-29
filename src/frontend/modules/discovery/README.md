# @ocelescope/discovery

The **Model Discovery** module for [Ocelescope](https://github.com/promi4s/ocelescope).

A tool for discovering object-centric event logs, allowing you to create various plots such as OC-DFGs or OC-Petri-Nets.

It is a frontend module that plugs into the Ocelescope app shell via
`@ocelescope/core`'s `defineModule`.

## Installation

```bash
pnpm add @ocelescope/discovery
```

## Integration

Register the module in your `ocelescope.config.ts` by adding its default
export to the `modules` array:

```ts
// ocelescope.config.ts
import type { OcelescopeConfig } from "@ocelescope/core";
import discovery from "@ocelescope/discovery";

export default {
  modules: [discovery],
} satisfies OcelescopeConfig;
```

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs (OCEL) developed at the Chair of Process
and Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
