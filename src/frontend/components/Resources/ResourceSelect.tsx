import { useResources } from "@/api/fastapi/resources/resources";
import { Select } from "@mantine/core";
import { ComponentProps } from "react";

const ResourceSelect: React.FC<
  ComponentProps<typeof Select> & { type?: string }
> = ({ type, ...props }) => {
  const { data: resources = [] } = useResources({ resource_type: type });

  return (
    <Select
      {...props}
      defaultValue={resources[0]?.id}
      data={resources.map(({ name, id }) => ({ value: id, label: name }))}
    ></Select>
  );
};

export default ResourceSelect;
