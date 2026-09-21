# @ocelescope/pnpm-plugin-catalog

Provides the dependency catalog of an Ocelescope release to module workspaces,
so a module always uses the same versions as the `@ocelescope/*` packages it
builds against.

```sh
pnpm add --config @ocelescope/pnpm-plugin-catalog
```

Then reference shared dependencies with `catalog:`:

```json
{
  "peerDependencies": {
    "@ocelescope/core": "catalog:",
    "@mantine/core": "catalog:",
    "react": "catalog:"
  }
}
```

To move to a new Ocelescope release, update the config dependency:

```sh
pnpm add --config @ocelescope/pnpm-plugin-catalog@latest
```

Entries from this plugin override entries with the same name in the module's
own `catalog`. Keep only module-specific dependencies there.
