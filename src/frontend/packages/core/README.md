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

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs (OCEL) developed at the Chair of Process
and Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
