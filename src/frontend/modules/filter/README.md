# @ocelescope/filter

The **Log Filter** module for [Ocelescope](https://github.com/promi4s/ocelescope).

Basic filtering functionality for object-centric event logs.

It is a frontend module that plugs into the Ocelescope app shell via
`@ocelescope/core`'s `defineModule`.

It pairs with the [`ocelescope-module-filter`](https://pypi.org/project/ocelescope-module-filter/)
backend module, which provides its API.

## Installation

```bash
pnpm add @ocelescope/filter
```

## Integration

Register the module in your `ocelescope.config.ts` by adding its default
export to the `modules` array:

```ts
// ocelescope.config.ts
import type { OcelescopeConfig } from "@ocelescope/core";
import filter from "@ocelescope/filter";

export default {
  modules: [filter],
} satisfies OcelescopeConfig;
```

This module's date filters rely on the Mantine dates stylesheet. Add
`@mantine/dates` to your app's `dependencies` and import its styles once in
your app entry point (`pages/_app.tsx`), after `@mantine/core/styles.css`:

```tsx
import "@mantine/dates/styles.css";
```

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs (OCEL) developed at the Chair of Process
and Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
