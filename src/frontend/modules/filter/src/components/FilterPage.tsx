import { ActionIcon, LoadingOverlay, Tooltip } from "@mantine/core";
import {
  defineModuleRoute,
  OCELViewBuilder,
  useCurrentOcel,
  useInvalidate,
} from "@ocelescope/core";
import { CheckIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import hash from "object-hash";
import { useGetFilter, useSetFilter } from "../api/base";
import { useFilterView } from "../hooks/useView";
import { FILTER_KINDS } from "./FilterViews";

const CLEANUP_NOTE =
  "The steps run from top to bottom. After the last step the log is cleaned up: relations whose event or object is gone are removed, events without at least one E2O relation are filtered out, and objects without any E2O or O2O relation are filtered out too.";

const FilterPage = () => {
  const { id: ocelId } = useCurrentOcel();

  const { data: filterPipeline, refetch } = useGetFilter(ocelId ?? "", {
    query: { enabled: !!ocelId },
  });

  const invalidate = useInvalidate();

  const { mutate, status } = useSetFilter({
    mutation: {
      onSuccess: async () => {
        refetch();
        await invalidate(["ocels"]);
      },
    },
  });

  return (
    <>
      {filterPipeline && ocelId && (
        <OCELViewBuilder
          key={hash(filterPipeline)}
          ocelId={ocelId}
          kinds={FILTER_KINDS}
          useView={useFilterView}
          defaultSteps={filterPipeline}
          storageKey="filter"
          labels={{
            note: CLEANUP_NOTE,
            add: "Add filter",
            search: "Search filters",
            noMatch: "No filter matches",
            emptyList: "No filters yet. Add one to start the pipeline.",
            emptyEditor:
              "Add a filter to the pipeline on the right to start filtering.",
          }}
          actions={({ completeSteps, isDirty, reset }) => (
            <>
              {isDirty && (
                <>
                  <Tooltip label="Apply">
                    <ActionIcon
                      variant="subtle"
                      color="green"
                      onClick={() => mutate({ ocelId, data: completeSteps })}
                    >
                      <CheckIcon size={20} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Discard changes">
                    <ActionIcon variant="subtle" color="yellow" onClick={reset}>
                      <RotateCcwIcon size={20} />
                    </ActionIcon>
                  </Tooltip>
                </>
              )}
              {filterPipeline.length > 0 && (
                <Tooltip label="Remove all filters">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => mutate({ ocelId, data: [] })}
                  >
                    <Trash2Icon size={20} />
                  </ActionIcon>
                </Tooltip>
              )}
            </>
          )}
        />
      )}
      <LoadingOverlay visible={status === "pending"} />
    </>
  );
};

export default defineModuleRoute({
  component: FilterPage,
  label: "Filter",
  name: "filter",
  requiresOcel: true,
});
