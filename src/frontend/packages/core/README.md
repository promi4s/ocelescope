# @ocelescope/core

Core React component and style library for [Ocelescope](https://github.com/promi4s/ocelescope).
It provides the application shell, the module system and the shared UI building
blocks that every Ocelescope frontend module is built on.

It is built on [Mantine](https://mantine.dev/) for UI and
[TanStack Query](https://tanstack.com/query) for data fetching, and is designed
to run inside a [Next.js](https://nextjs.org/) (Pages Router) app.

## Installation

```bash
pnpm add @ocelescope/core
```

`@ocelescope/core` relies on a number of peer dependencies (notably `react`,
`react-dom`, `next`, `@mantine/*`, `@tanstack/react-query`, `dayjs` and
`zustand`). When building a full app you normally install them alongside the
Ocelescope packages — see the [app template](https://github.com/promi4s/ocelescope)
for a complete setup.

## Usage

### Setting up the app (Next.js Pages Router)

```tsx
// pages/_app.tsx

import "@ocelescope/core/styles.css";

import { OcelescopeApp } from "@ocelescope/core";
import config from "../ocelescope.config";

export default OcelescopeApp(config);
```

> **Styles.** `@ocelescope/core/styles.css` is the only stylesheet an app needs.
> It inlines the third-party global CSS core and the Ocelescope modules rely on
> (`@mantine/core` and its `dates` / `charts` / `dropzone` / `notifications`
> extensions, `mantine-datatable`, `@xyflow/react`, `@r4pm/components`) ahead of
> core's own component styles, in cascade order — so do not import those
> stylesheets again. A module that ships its own stylesheet documents it; import
> those after core's.

```tsx
// pages/_document.tsx
import { OcelescopeDocument } from "@ocelescope/core";

export default OcelescopeDocument;
```

```tsx
// pages/[[...slug]].tsx — renders the registered modules
import { createModulesPage } from "@ocelescope/core";
import config from "../ocelescope.config";

const page = createModulesPage(config);

export const getStaticPaths = page.getStaticPaths;
export const getStaticProps = page.getStaticProps;
export default page.ModulePage;
```

```ts
// ocelescope.config.ts — register modules
import type { OcelescopeConfig } from "@ocelescope/core";
import ocelot from "@ocelescope/ocelot";

export default {
  modules: [ocelot],
} satisfies OcelescopeConfig;
```

### Defining a module

A module bundles metadata and one or more routes:

```tsx
import { defineModule, defineModuleRoute } from "@ocelescope/core";
import { TableIcon } from "lucide-react";
import EventsView from "./routes/events";

const eventsRoute = defineModuleRoute({
  name: "events",
  label: "Events",
  requiresOcel: true,
  component: EventsView,
});

export default defineModule({
  name: "example",
  label: "Example",
  description: "An example Ocelescope module",
  authors: [{ name: "Your Name" }],
  icon: TableIcon,
  routes: [eventsRoute],
});
```

### Charts

`OcelChart` runs DuckDB SQL against the selected OCEL and draws the result. The
query is usually the whole configuration: the first non-numeric column goes
across, the numeric ones go up.

```tsx
import { OcelChart } from "@ocelescope/core";

export const EventsByActivity = () => (
  <OcelChart
    title="Events per activity"
    colorScope="activity"
    sql={`SELECT "ocel:activity" AS activity, count(*) AS events
          FROM events GROUP BY 1 ORDER BY 2 DESC`}
  />
);
```

Bar, line, area, scatter and pie; `series` unfolds a column into one series per
value, `stacked` and `horizontal` change the shape, `types` offers the reader a
switch between chart types, and `x`/`y` override the columns when the defaults
guess wrong. Only a single `SELECT` runs, over the OCEL's stored tables
(`events`, `objects`, `e2o`, `o2o`, `object_changes`); bind values through
`parameters` rather than building SQL by hand. `SqlChart` is the same chart for
a result you already have.

Line charts can share a scale or overlay an independent scale per line. The
second form is useful for measures with different units or very different
ranges:

```tsx
<OcelChart
  type="line"
  x="time"
  y="value"
  series="measure"
  yAxes="independent"
  sql={measurements}
/>
```

Charts are r4pm viewers. Colours come from the ambient `ViewerConfig` when a
`colorScope` is given, so a category keeps the colour the graph viewers give it;
clicks report a `ViewerTarget` to `onSelect`; and a chart inside a
`<ViewerExportFrame>` exports with everything else in the frame:

```tsx
<ViewerExportFrame filename="activities">
  <OcelChart title="Events per activity" sql={events} />
  <OcelChart title="Objects per type" sql={objects} series="type" stacked />
</ViewerExportFrame>
```

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs (OCEL) developed at the Chair of Process
and Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
