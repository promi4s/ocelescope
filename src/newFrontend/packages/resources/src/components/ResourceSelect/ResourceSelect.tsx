import { Select } from "@mantine/core";
import { useResources } from "@ocelescope/api-base";
import type { ComponentProps } from "react";

const ResourceSelect: React.FC<
  ComponentProps<typeof Select> & { type: string }
> = ({ type, ...props }) => {
  const { data: resources = [] } = useResources({ resource_type: type });

  return (
    <Select
      {...props}
      defaultValue={resources[0]?.id ?? null}
      data={resources.map(({ name, id }) => ({ value: id, label: name }))}
    />
  );
};

export default ResourceSelect;
