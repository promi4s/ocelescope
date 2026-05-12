import { Select } from "@mantine/core";
import { useEventCounts, useObjectCounts } from "@ocelescope/api-base";
import { type ComponentProps, useEffect, useMemo } from "react";

const entityCountHook = {
  objects: useObjectCounts,
  activities: useEventCounts,
} as const;

export const EntityTypeSelect: React.FC<
  { ocelId: string; entityType: keyof typeof entityCountHook } & Omit<
    ComponentProps<typeof Select>,
    "data"
  >
> = ({ entityType, ocelId, value, onChange, ...props }) => {
  const { data: entityCounts } = entityCountHook[entityType](ocelId);

  const entityNames = useMemo(
    () => Object.keys(entityCounts ?? {}),
    [entityCounts],
  );

  useEffect(() => {
    const firstEntityName = entityNames[0];

    if (value == null && onChange && firstEntityName) {
      onChange(firstEntityName, {
        label: firstEntityName,
        value: firstEntityName,
        disabled: false,
      });
    }
    if (value != null && onChange && !entityNames.includes(value)) {
      onChange(null, {
        label: "",
        value: "",
        disabled: false,
      });
    }
  }, [entityNames, value]);

  return (
    <Select
      data={entityNames}
      {...(value && { value })}
      {...(onChange && { onChange })}
      {...props}
    />
  );
};
