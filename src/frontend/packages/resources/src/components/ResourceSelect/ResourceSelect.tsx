import { Select } from "@mantine/core";
import { useResources } from "@ocelescope/api-base";
import type { ComponentProps } from "react";

export const ResourceSelect: React.FC<
  Omit<ComponentProps<typeof Select<string>>, "data"> & { type?: string }
> = ({ type, value, ...props }) => {
  const { data: resources = [] } = useResources({ schema_hash: type ?? null });

  return (
    <Select
      {...props}
      data={resources.map(({ name, id }) => ({ value: id, label: name }))}
    />
  );
};
