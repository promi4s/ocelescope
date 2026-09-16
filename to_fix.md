# To fix — review of `feat/discovery-overhaul` (vs `main`)

Already fixed: the PNML download route using the removed `_CORE_RESOURCE_NAMESPACE` (commit f2694d0).

## 1. Threshold slider works the opposite of its description (medium)
`src/backend/ocelescope-backend/src/ocelescope_backend/app/internal/util/base_plugin.py:26`

- [ ] The description says "Higher values filter out more infrequent behavior", but both methods do the opposite:
  - **Directly-follows graph:** `threshold` is passed as the share of edges to keep, so 1 keeps everything.
  - **Petri net:** uses `noise_threshold = 1 - threshold`, so higher values filter less.
- [ ] **Slider at 0:** the slider allows 0. There `dfg.py:168` (`keep = math.ceil(len * 0) == 0`) keeps no edges for any object type and returns a completely empty graph. The Petri net runs with maximum noise filtering.

## 2. Selecting nothing means using everything (medium)
`src/ocelescope/src/ocelescope/discovery/algorithms/dfg_miner.py:32`, `src/ocelescope/src/ocelescope/discovery/algorithms/inductive_miner.py:37`

- [ ] An empty `included_activities` or `included_object_types` list is treated as "no filter". If the user deselects everything in the picker, it shows "Nothing selected", but discovery runs on every activity and object type.

## 3. Switching OCEL runs discovery with the old log's selections (medium)
`src/frontend/modules/discovery/src/components/DiscoveryPage.tsx:57`

- [ ] The run effect re-fires as soon as `id` changes, but `debouncedInput` still holds the previous log's activity and object-type names, and it passes validation.
- [ ] Those names don't exist in the new log, so the filter matches nothing. The result is an empty DFG or a failed Petri net task with an error toast.
- [ ] The correct run only starts about a second later, once the form's defaults reach the debounced input.

## 4. A failed task leaves the result area loading forever (medium)
`src/frontend/packages/plugin-components/src/Results/ResultSection.tsx:31`

- [ ] **Endless polling:** `refetchInterval` keeps going while `data == null`, and `GET /plugins/task/{id}` returns `None` for failed tasks. It polls every second and the loading overlay never goes away. The old discovery page only polled while a task was PENDING or STARTED and then showed the error.
- [ ] **No retry:** deduplication (`PluginTask.create_plugin_task`) hands back the same failed task id when the input is unchanged, so running it again doesn't help.
- [ ] **Errors go nowhere:** `useRunPlugin` in `DiscoveryPage.tsx` has no `onError` handler.

## 5. A single available method is never auto-selected (low)
`src/frontend/modules/discovery/src/components/DiscoveryPage.tsx:52`

- [ ] `discoveryMethods.length > 1` should be `> 0`. With exactly one method, none is selected and nothing runs.

## 6. Saving several results gives them all the first name (medium)
`src/backend/ocelescope-backend/src/ocelescope_backend/app/routes/plugins.py:119`

- [ ] `next(result.name for result in selection)` always takes the first selection's name, not the one for the current `index`.
- [ ] Saving several results with different names gives all of them the first name. If the first name is empty, every result gets a default name, even ones the user named.

## 7. `OCEL_FIELD` no longer accepts `default=` (medium)
`src/ocelescope/src/ocelescope/plugin/input.py:12`

- [ ] The `default=` keyword was removed from this public function. Any existing plugin calling `OCEL_FIELD(..., default=...)` now raises a TypeError on import, so the plugin fails to load.
- [ ] Either keep accepting `default` or treat this as a breaking change.

## 8. `@discovery_method` is only marked deprecated, but no longer works (medium)
`src/ocelescope/src/ocelescope/discovery/decorator.py:30`

- [ ] The backend no longer looks for `__discovery_meta__` (the discovery registry and routes are gone).
- [ ] A plugin's decorated functions silently vanish, and a module with no `Plugin` subclass now fails to load with `PluginNotFound`.

## 9. `filter_edges` changed meaning and is slow on large logs (low)
`src/ocelescope/src/ocelescope/resource/default/dfg.py:177`

- [ ] **Changed meaning:** the public method went from "keep edges whose relative frequency is at least the threshold" to "keep the top fraction". Existing calls like `filter_edges(0.1)` now keep only the top 10% instead of most edges.
- [ ] **Slow on large logs:** for each object type it runs a networkx reachability search after every candidate edge removal, which grows roughly quadratically with the edge count. Logs with many activities can take seconds per run, and discovery reruns on every debounced settings change.
