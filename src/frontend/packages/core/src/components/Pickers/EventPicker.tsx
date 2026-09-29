import { useEventIds } from "@ocelescope/api-base";
import { useMemo } from "react";
import { useOcelId } from "./internal/useOcelId";
import { useSearch } from "./internal/useSearch";
import { OptionPicker } from "./OptionPicker";
import type { OcelPickerProps } from "./types";

export type EventPickerProps = OcelPickerProps<string> & {
  /** How many ids a search turns up. */
  limit?: number;
};

/** Events of the log, found by typing part of an id. */
export const EventPicker = ({
  ocelId,
  ocelVersion = "filtered",
  limit = 50,
  ...picker
}: EventPickerProps) => {
  const id = useOcelId(ocelId);
  const { search, setSearch, debounced } = useSearch();
  const { data, isFetching, error } = useEventIds(
    id,
    { search: debounced, size: limit, ocel_version: ocelVersion },
    { query: { enabled: id != null } },
  );
  const options = useMemo(
    () =>
      (data?.response ?? []).map((eventId) => ({
        value: eventId,
        label: eventId,
      })),
    [data],
  );

  return (
    <OptionPicker
      options={options}
      search={search}
      onSearch={setSearch}
      loading={isFetching}
      error={error}
      placeholder="Search for an event…"
      emptyText="No event matches"
      sort="name"
      counts={false}
      bars={false}
      {...picker}
    />
  );
};
