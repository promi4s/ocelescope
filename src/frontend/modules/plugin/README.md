# @ocelescope/plugin

The **Plugins** module for [Ocelescope](https://github.com/promi4s/ocelescope).

Run process mining plugins inside Ocelescope.

It is a frontend module that plugs into the Ocelescope app shell via
`@ocelescope/core`'s `defineModule`.

## Installation

```bash
pnpm add @ocelescope/plugin
```

## Integration

Register the module in your `ocelescope.config.ts` by adding its default
export to the `modules` array:

```ts
// ocelescope.config.ts
import type { OcelescopeConfig } from "@ocelescope/core";
import plugins from "@ocelescope/plugin";

export default {
  modules: [plugins],
} satisfies OcelescopeConfig;
```

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs (OCEL) developed at the Chair of Process
and Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
