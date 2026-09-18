import { useObjectIds } from "@ocelescope/api-base";
import { IdPicker, type IdPickerProps } from "./IdPicker";
import { useOcelId } from "./internal/useOcelId";
import { useSearch } from "./internal/useSearch";
import type { OcelSource, Selection } from "./types";

export type ObjectPickerProps = OcelSource &
  Omit<IdPickerProps, "ids" | "search" | "onSearch" | "loading"> & {
    /** How many ids a search turns up. */
    limit?: number;
  };

/** Objects of the log, found by typing part of an id. */
export const ObjectPicker = ({
  ocelId,
  ocelVersion = "filtered",
  limit = 50,
  ...picker
}: ObjectPickerProps & Selection) => {
  const id = useOcelId(ocelId);
  const { search, setSearch, debounced } = useSearch();
  const { data, isPending } = useObjectIds(
    id,
    { search: debounced, size: limit, ocel_version: ocelVersion },
    { query: { enabled: id != null } },
  );

  return (
    <IdPicker
      ids={data?.response ?? []}
      search={search}
      onSearch={setSearch}
      loading={isPending}
      {...picker}
    />
  );
};
