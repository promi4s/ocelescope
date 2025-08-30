import {
  useE2o,
  useEventAttributes,
  useEventCounts,
} from "@/api/fastapi/ocels/ocels";
import { Input, LoadingOverlay, Stack } from "@mantine/core";
import { SearchIcon } from "lucide-react";
import { useDebouncedState } from "@mantine/hooks";
import EntityOverview from "../components/EntityOverview";
import { defineModuleRoute } from "@/lib/modules";
import useCurrentOcel from "@/hooks/useCurrentOcel";

const EventOverview = () => {
  const { id } = useCurrentOcel();
  const { data: eventsAttributes = {} } = useEventAttributes({
    ocel_id: id,
  });
  const { data: e2o = [] } = useE2o({ ocel_id: id });
  const { data: eventCounts, isLoading: isEventCountsLoading } = useEventCounts(
    { ocel_id: id },
  );

  const [searchValue, setSearchValue] = useDebouncedState("", 200);
  return (
    <>
      <LoadingOverlay visible={isEventCountsLoading} />
      <Stack>
        <Input
          leftSection={<SearchIcon />}
          defaultValue={searchValue}
          onChange={(newSearch) => setSearchValue(newSearch.target.value)}
        />
        {eventCounts && (
          <EntityOverview
            relations={e2o}
            entityCounts={eventCounts}
            attributes={eventsAttributes}
            search={searchValue}
          />
        )}
      </Stack>
    </>
  );
};

export default defineModuleRoute({
  component: EventOverview,
  label: "Event Overview",
  name: "eventOverview",
  requiresOcel: true,
});
