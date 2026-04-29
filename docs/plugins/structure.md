## Plugin Structure

Plugins are packaged as Python modules and distributed as `.zip`
archives.

!!! example "Example Ocelescope plugin structure"

    ```sh
    plugin.zip/
    └── plugin/
        ├── __init__.py  # Entry point
        ├── plugin.py
        └── util/
            ├── discovery.py
            └── ...
    ```

The `__init__.py` file serves as the plugin's entry point.

------------------------------------------------------------------------

## Available Templates

Ocelescope provides ready-to-use templates to simplify development:

### Minimal Plugin Template (GitHub)

A minimal example plugin is available on GitHub:

``` bash
git clone https://github.com/Grkmr/minimal-plugin.git
cd minimal-plugin
```

------------------------------------------------------------------------

For detailed setup instructions, refer to the [Setup section of the
tutorial](./tutorial.md#step-1-setup).
