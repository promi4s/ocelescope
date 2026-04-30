# @ocelescope/variants

React components for rendering **variants** in Ocelescope.

Currently, this package exports a single component:

- `Variant` — renders a sequence of activities as a compact, colored “ribbon”.

## Installation

This package is primarily developed inside the Ocelescope pnpm workspace.
If you consume it from npm, install it like any other package.

## Usage

```tsx
import { Variant } from "@ocelescope/variants";
import "@ocelescope/variants/styles.css";

export function Example() {
  return (
    <Variant
      variant={["Create", "Approve", "Ship", "Invoice"]}
      colors={{ Approve: "#7c3aed" }}
    />
  );
}
```

### Props

- `variant: string[]`  
  The ordered list of activity labels.

- `colors?: Record<string, string>`  
  Optional overrides for activity colors. Activities not present in `colors` get a deterministic generated color.

## Development (monorepo)

From the repository root:

```bash
pnpm i
```

Build just this package:

```bash
pnpm --filter @ocelescope/variants build
```

Run Storybook:

```bash
pnpm --filter @ocelescope/variants storybook
```
