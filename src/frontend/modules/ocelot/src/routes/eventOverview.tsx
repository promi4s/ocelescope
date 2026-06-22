import { Input, LoadingOverlay, Stack, Text, Title } from "@mantine/core";
import { useDebouncedState } from "@mantine/hooks";
import {
  useE2o,
  useEventAttributes,
  useEventCounts,
} from "@ocelescope/api-base";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import { SearchIcon } from "lucide-react";
import EntityOverview from "../components/EntityOverview";

const EventOverview = () => {
  const { id } = useCurrentOcel();
  const { data: eventsAttributes = [] } = useEventAttributes(id);
  const { data: e2o } = useE2o(id);
  const { data: eventCounts, isLoading: isEventCountsLoading } =
    useEventCounts(id);

  const [searchValue, setSearchValue] = useDebouncedState("", 200);
  return (
    <>
      <LoadingOverlay visible={isEventCountsLoading} />
      <Stack>
        <Title order={2}>Event Overview</Title>
        <Text c="dimmed" size="sm">
          Get an overview of all event types in this log. Search through them
          and see how often each type occurs, what attributes it carries, and
          which objects it has a relation with.
        </Text>
        <Input
          leftSection={<SearchIcon />}
          defaultValue={searchValue}
          onChange={(newSearch) => setSearchValue(newSearch.target.value)}
        />
        {eventCounts && (
          <EntityOverview
            relations={e2o?.response ?? []}
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
