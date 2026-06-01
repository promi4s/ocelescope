# Plugin Environment

Ocelescope plugins run in a **fixed Python environment** provided by the Ocelescope runtime.
Plugins can only rely on packages that are available in the Ocelescope environment.

## Available packages

The following sections show the packages available in the Ocelescope environment.
The first list shows the packages defined for the environment.
The second list shows the complete installed package set, including transitive dependencies.

If you need a package that is not available in the environment, please contact us at [ocelescope@pads.rwth-aachen.de](mailto:ocelescope@pads.rwth-aachen.de).

??? info "Packages defined for the Ocelescope environment"
    {% for dep in env_list %}
    - `{{ dep }}`
    {% endfor %}

??? info "Complete installed environment (`pip freeze`)"
    {% for dep in freeze_list %}
    - `{{ dep }}`
    {% endfor %}

## Installing the plugin extra

Ocelescope exposes an optional dependency group for plugin-related packages.
You can install it with:

```bash
pip install "ocelescope[plugin]"
```

This is the recommended way to install packages that are intended to be available in the shared plugin environment.
