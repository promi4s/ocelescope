import { Select } from "@mantine/core";
import { useResources } from "@ocelescope/api-base";
import type { ComponentProps } from "react";

export const ResourceSelect: React.FC<
  ComponentProps<typeof Select> & { type: string }
> = ({ type, value, ...props }) => {
  const { data: resources = [] } = useResources({ resource_type: type });

  return (
    <Select
      {...props}
      value={value ?? null}
      data={resources.map(({ name, id }) => ({ value: id, label: name }))}
    />
  );
};
