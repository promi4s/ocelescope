# Building a Plugin

Ocelescope plugins are distributed as `.zip` files.

We strongly recommend starting from the [plugin template](https://github.com/promi4s/plugin-template).

## ZIP structure

Your ZIP should contain the plugin package directly:

```sh
MyPlugin.zip/
└── my_plugin/
    ├── __init__.py
    ├── plugin.py
    └── ...
```

You can zip your plugin manually, or use one of the following options.

## Option 1: Use `ocelescope build`

`ocelescope build` expects the template-style project structure, with your plugin package inside `src/`.

```sh
my-plugin/
├── src/
│   └── my_plugin/
│       ├── __init__.py
│       ├── plugin.py
│       └── ...
└── dist/
```

From the project root:

```sh
ocelescope build
```

Or with `uv`:

```sh
uv run ocelescope build
```

The generated plugin ZIP is written to `dist/`.

!!! warning "Use relative imports only"
    ```python
    from .resource import MyResource
    from .util import helper
    ```

## Option 2: Use the GitHub Action from the template

The template also includes a GitHub Actions workflow that builds the plugin ZIP and publishes it to a GitHub release.

Create and push a version tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

After the workflow runs, you can find the plugin ZIP:

- in the workflow artifacts, and
- in the GitHub release assets.

## Submit a Plugin

Currently, plugins can only be submitted through GitHub.

Upload your plugin ZIP to a GitHub release in your plugin repository, then submit it using our [Issue template](https://github.com/promi4s/ocelescope/issues/new?template=plugin-submission.yml).
