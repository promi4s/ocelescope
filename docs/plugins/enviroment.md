# Plugin Environment

Ocelescope plugins run in a **fixed Python environment** provided by the Ocelescope runtime.
Plugins can only rely on packages that are available in the Ocelescope environment.

## Available packages

The following sections show the packages available in the Ocelescope environment.
The first list shows the packages defined for the environment.
The second list shows the complete installed package set, including transitive dependencies.

If you need a package that is not available in the plugin environment, please [open a package request on GitHub](https://github.com/promi4s/ocelescope/issues/new?template=plugin-package-request.yml).

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

## Bundling wheel files inside a plugin

If your plugin needs a dependency that is **not** available in the shared plugin environment, you can bundle wheel files directly inside the plugin.

This is especially useful for compiled packages such as **Rust bindings**.

Store the wheels inside a `wheels/` folder in your plugin package:

```sh
my-plugin/
├── src/
│   └── my_plugin/
│       ├── __init__.py
│       ├── plugin.py
│       └── wheels/
│           ├── some_package-1.0.0-cp313-cp313-manylinux_2_17_x86_64.manylinux2014_x86_64.whl
│           └── some_package-1.0.0-cp313-cp313-manylinux_2_17_aarch64.manylinux2014_aarch64.whl
└── pyproject.toml
```

After building, the plugin ZIP should look like this:

```sh
MyPlugin.zip/
└── my_plugin/
    ├── __init__.py
    ├── plugin.py
    └── wheels/
        ├── some_package-1.0.0-cp313-cp313-manylinux_2_17_x86_64.manylinux2014_x86_64.whl
        └── some_package-1.0.0-cp313-cp313-manylinux_2_17_aarch64.manylinux2014_aarch64.whl
```

Build wheels that are compatible with **Python 3.13**.
If you want to support both **amd64** and **arm64**, include one wheel for each platform.

!!! warning "Bundle self-contained wheels"
    Bundled wheels should not rely on additional wheels being loaded in a specific order.
    If you use bundled wheels, they should already contain everything needed to be imported successfully in the plugin environment.
