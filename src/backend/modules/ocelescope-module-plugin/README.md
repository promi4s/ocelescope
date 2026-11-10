# ocelescope-module-plugin

Ocelescope backend module for uploading, listing, running and deleting plugins,
including the built-in discovery plugin. Plugin zips dropped on the generic
session upload are claimed by this module through `Module.claim_upload`.

Plugins are stored in `PLUGIN_DIR`. Mounted at `/modules/plugin/v1`.
