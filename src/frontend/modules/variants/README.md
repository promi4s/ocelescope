# @ocelescope/variants

The **Variants** module for [Ocelescope](https://github.com/promi4s/ocelescope).

A tool for exploring object trace variants: the distinct activity sequences
that objects of each type follow, with per-variant event and case counts.

It is a frontend module that plugs into the Ocelescope app shell via
`@ocelescope/core`'s `defineModule`.

## Installation

```bash
pnpm add @ocelescope/variants
```

## Integration

Register the module in your `ocelescope.config.ts` by adding its default
export to the `modules` array:

```ts
// ocelescope.config.ts
import type { OcelescopeConfig } from "@ocelescope/core";
import variants from "@ocelescope/variants";

export default {
  modules: [variants],
} satisfies OcelescopeConfig;
```

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs (OCEL) developed at the Chair of Process
and Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
