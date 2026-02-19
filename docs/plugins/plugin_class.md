# Plugin Class

Plugins are defined by a **single plugin class** that inherits from the `Plugin` base class provided by the Ocelescope Python package.

A plugin class contains:

- **Metadata** (e.g., label, description, version) that is displayed in the frontend’s plugin interface.
- **Runnable functions** (plugin methods) that can be invoked from within Ocelescope.

<figure markdown="span">
  ![An example plugin class](../assets/plugintouimapping.png)
  <figcaption align="center">Example of an Ocelescope plugin in code and in the app.</figcaption>
</figure>

Each plugin package must export **exactly one** plugin class via its `__init__.py`.

!!! example "An example plugin"
    ```py title="plugin.py"
    from ocelescope import OCEL, PetriNet, Plugin, plugin_method

    class DiscoveryPlugin(Plugin):
        label = "Discovery Plugin"
        description = "An Ocelescope plugin"
        version = "1.0.0"

        @plugin_method(
            label="Discover Petri Net",
            description="Discover an object-centric Petri net",
        )
        def discover_ocpn(self, ocel: OCEL) -> PetriNet: ...
    ```

    ```py title="__init__.py"
    from .plugin import DiscoveryPlugin

    __all__ = [
        "DiscoveryPlugin",
    ]
    ```
