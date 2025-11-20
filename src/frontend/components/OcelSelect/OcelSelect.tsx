import { useGetOcels } from "@/api/fastapi/ocels/ocels";
import { Select } from "@mantine/core";
import { type ComponentProps, useMemo } from "react";

const OcelSelect: React.FC<
  ComponentProps<typeof Select> & { extension?: string }
> = ({ extension, ...props }) => {
  const { data } = useGetOcels({ extension_name: extension });

  const ocels = useMemo(() => data ?? [], [data]);

  return (
    <Select
      {...props}
      data={ocels.map(({ name, id }) => ({ value: id, label: name }))}
    />
  );
};

export default OcelSelect;
