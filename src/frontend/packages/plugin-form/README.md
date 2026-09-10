# @ocelescope/plugin-form

Renders a plugin method's **configuration schema** as a Mantine form.

The package covers the configuration input only — selecting the resources a
method runs on is left to the caller, so the resources can either be picked by
the user or set to fixed ids.

On top of the JSON schema fields provided by [`@rjsf/mantine`](https://rjsf-team.github.io/react-jsonschema-form),
it renders the Ocelescope-specific `x-ui-meta` field types: OCEL selects
(`ocel`), server-computed selects (`computed_select`), a Monaco code editor
(`code`) and sliders (`slider`), plus a multi select for string enum arrays.

## Installation

```bash
pnpm add @ocelescope/plugin-form
```

## Usage

```tsx
import { PluginForm } from "@ocelescope/plugin-form";

const [config, setConfig] = useState({});

<PluginForm
  pluginId={pluginId}
  methodName={method.name}
  schema={method.configuration_schema}
  inputResources={{ ocel: ocelId }}
  value={config}
  onChange={setConfig}
  onSubmit={run}
/>;
```

`inputResources` maps a method input name to the id of the resource it is bound
to. `ocel` fields resolve their options against it (an `OCEL_FIELD(ocel_id=…)`
looks up the entry of that name), and `computed_select` fields send it to the
plugin along with the current configuration. Pass fixed ids, or watch them from
a surrounding form to let the user choose.

## About

Part of [Ocelescope](https://github.com/promi4s/ocelescope), a framework for
working with Object-Centric Event Logs (OCEL) developed at the Chair of Process
and Data Science (PADS), RWTH Aachen University.

📖 Documentation: <https://www.ocelescope.org>
