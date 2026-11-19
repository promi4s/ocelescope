import {
  ActionIcon,
  Combobox,
  Group,
  MultiSelect,
  type MultiSelectProps,
  Popover,
  Select,
  type SelectProps,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useEventIds, useObjectIds } from "@ocelescope/api-base";
import { FilterIcon } from "lucide-react";
import { useState } from "react";
import { ActivityPicker } from "./ActivityPicker";
import { useOcelId } from "./internal/useOcelId";
import { ObjectTypePicker } from "./ObjectTypePicker";
import type { OcelSource } from "./types";

type ControlledProps = "data" | "value" | "defaultValue" | "onChange";

type MergedSelectProps =
  | ({
      multiple: true;
      value: string[];
      onChange: (value: string[]) => void;
    } & Omit<MultiSelectProps, ControlledProps>)
  | ({
      multiple?: false;
      value: string | null;
      onChange: (value: string | null) => void;
    } & Omit<SelectProps, ControlledProps>);

const MergedSelect = (props: MergedSelectProps & { data?: string[] }) => {
  if (props.multiple) {
    const { multiple, ...rest } = props;
    return (
      <MultiSelect
        styles={{
          pillsList: {
            flexWrap: "nowrap",
            overflowX: "auto",
            scrollbarWidth: "none",
          },
          pill: { flexShrink: 0 },
          inputField: { minWidth: "4rem" },
        }}
        {...rest}
      />
    );
  }
  const { multiple, ...rest } = props;
  return <Select {...rest} />;
};

type IdQuery = {
  ocelId: string;
  types: string[];
  search: string | undefined;
  size: number;
  ocelVersion: OcelSource["ocelVersion"];
  viewId: string | undefined;
};

const queryOptions = (ocelId: string) => ({
  query: {
    enabled: ocelId !== "",
    placeholderData: <T,>(previous: T) => previous,
  },
});

const entities = {
  events: {
    label: "event",
    TypePicker: ActivityPicker,
    useIds: ({ ocelId, types, search, size, ocelVersion, viewId }: IdQuery) =>
      useEventIds(
        ocelId,
        {
          search,
          size,
          activities: types.length > 0 ? types : undefined,
          ocel_version: ocelVersion,
          view_id: viewId,
        },
        queryOptions(ocelId),
      ),
  },
  objects: {
    label: "object",
    TypePicker: ObjectTypePicker,
    useIds: ({ ocelId, types, search, size, ocelVersion, viewId }: IdQuery) =>
      useObjectIds(
        ocelId,
        {
          search,
          size,
          object_types: types.length > 0 ? types : undefined,
          ocel_version: ocelVersion,
          view_id: viewId,
        },
        queryOptions(ocelId),
      ),
  },
};

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

type ManagedProps =
  | "searchable"
  | "searchValue"
  | "defaultSearchValue"
  | "onSearchChange"
  | "filter"
  | "clearSectionMode"
  | "clearButtonProps"
  | "rightSection"
  | "rightSectionWidth"
  | "rightSectionProps"
  | "rightSectionPointerEvents"
  | "placeholder"
  | "nothingFoundMessage"
  | "loading"
  | "loadingPosition"
  | "loaderProps";

export type IdSelectProps = DistributiveOmit<MergedSelectProps, ManagedProps> &
  OcelSource & {
    limit?: number;
  };

const createIdSelect = (entityType: keyof typeof entities) => {
  const { label, TypePicker, useIds } = entities[entityType];

  const IdSelect = ({
    ocelId,
    ocelVersion = "filtered",
    viewId,
    limit = 50,
    ...props
  }: IdSelectProps) => {
    const id = useOcelId(ocelId) ?? "";

    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebouncedValue(search, 300);

    const { data, isFetching } = useIds({
      ocelId: id,
      types: selectedTypes,
      search: debouncedSearch || undefined,
      size: limit,
      ocelVersion,
      viewId,
    });

    const filtered = selectedTypes.length > 0;
    const hasValue = props.multiple
      ? props.value.length > 0
      : props.value != null;
    const canClear =
      (props.clearable ?? true) &&
      hasValue &&
      !props.disabled &&
      !props.readOnly;
    const clear = () => {
      if (props.multiple) props.onChange([]);
      else props.onChange(null);
      props.onClear?.();
    };

    return (
      <MergedSelect
        {...props}
        placeholder={`Search for an ${label}…`}
        nothingFoundMessage={`No ${label} matches`}
        data={data?.response}
        searchable
        clearable={false}
        onSearchChange={setSearch}
        filter={({ options }) => options}
        rightSectionPointerEvents="all"
        rightSectionWidth={canClear ? 80 : 56}
        rightSection={
          <Group gap={2} wrap="nowrap">
            {canClear && <Combobox.ClearButton onClear={clear} />}
            <Combobox.Chevron />
            <Popover position="bottom-end" shadow="md">
              <Popover.Target>
                <ActionIcon
                  variant="transparent"
                  color={filtered ? undefined : "gray"}
                  loading={isFetching}
                  loaderProps={{
                    size: 14,
                    color: "var(--mantine-primary-color-filled)",
                  }}
                  aria-label={`Filter by ${label} type`}
                >
                  <FilterIcon size={16} />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown>
                <TypePicker
                  multiple
                  variant="list"
                  ocelId={ocelId}
                  ocelVersion={ocelVersion}
                  viewId={viewId}
                  value={selectedTypes}
                  onChange={setSelectedTypes}
                />
              </Popover.Dropdown>
            </Popover>
          </Group>
        }
      />
    );
  };

  return IdSelect;
};

export const EventIdSelect = createIdSelect("events");
export const ObjectIdSelect = createIdSelect("objects");
