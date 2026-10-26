import { useEventCounts } from "@ocelescope/api-base";
import { useColorOf } from "@r4pm/components";
import { useMemo } from "react";
import { useOcelId } from "./internal/useOcelId";
import { OptionPicker } from "./OptionPicker";
import type { OcelPickerProps } from "./types";

export type ActivityPickerProps = OcelPickerProps<string> & {
  /** The events per activity to pick from; set, nothing is fetched. */
  data?: Record<string, number>;
};

/** The log's activities, by how many events each has. */
export const ActivityPicker = ({
  ocelId,
  ocelVersion = "filtered",
  data: given,
  ...picker
}: ActivityPickerProps) => {
  const id = useOcelId(ocelId);
  const colorOf = useColorOf("activity");
  const fetched = useEventCounts(
    id,
    { ocel_version: ocelVersion },
    { query: { enabled: id != null && given === undefined } },
  );
  const data = given ?? fetched.data;
  const isPending = given === undefined && fetched.isPending;
  const error = given === undefined ? fetched.error : null;
  const options = useMemo(
    () =>
      Object.entries(data ?? {}).map(([name, count]) => ({
        value: name,
        label: name,
        count,
        color: colorOf(name),
      })),
    [data, colorOf],
  );

  return (
    <OptionPicker
      options={options}
      loading={isPending}
      error={error}
      placeholder="Choose an activity…"
      emptyText="The log has no events"
      {...picker}
    />
  );
};
