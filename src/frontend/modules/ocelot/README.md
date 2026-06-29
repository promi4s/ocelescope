# @ocelescope/ocelot

The **Ocelot** module for [Ocelescope](https://github.com/promi4s/ocelescope).

A tool for exploring object-centric event logs, allowing you to search events and objects and visualize their relationships and attributes.

It is a frontend module that plugs into the Ocelescope app shell via
`@ocelescope/core`'s `defineModule`.

It pairs with the [`ocelescope-module-ocelot`](https://pypi.org/project/ocelescope-module-ocelot/)
backend module, which provides its API.

## Installation

```bash
pnpm add @ocelescope/ocelot
```

## Integration

Register the module in your `ocelescope.config.ts` by adding its default
export to the `modules` array:

```ts
// ocelescope.config.ts
import type { OcelescopeConfig } from "@ocelescope/core";
import ocelot from "@ocelescope/ocelot";

export default {
  modules: [ocelot],
} satisfies OcelescopeConfig;
```

This module ships its own styles, so also import them once in your app
entry point (`pages/_app.tsx`):

```tsx
import "@ocelescope/ocelot/styles.css";
```

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs (OCEL) developed at the Chair of Process
and Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
