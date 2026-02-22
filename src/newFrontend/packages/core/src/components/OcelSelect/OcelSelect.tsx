import { Select } from "@mantine/core";
import { useGetOcels } from "@ocelescope/api-base";
import { type ComponentProps, useMemo } from "react";
import { useCurrentOcel } from "../../hooks/useCurrentOCEL";

const OcelSelect: React.FC<
  ComponentProps<typeof Select> & { extension?: string }
> = ({ extension, ...props }) => {
  const { data } = useGetOcels(extension ? { extension_name: extension } : {});

  const ocels = useMemo(() => data ?? [], [data]);

  return (
    <Select
      {...props}
      data={ocels.map(({ name, id }) => ({ value: id, label: name }))}
    />
  );
};

export const CurrentOcelSelect: React.FC = () => {
  const { id, setCurrentOcel } = useCurrentOcel();

  return (
    <OcelSelect
      value={id}
      unselectable={"off"}
      onChange={(id) => {
        if (id) {
          setCurrentOcel(id);
        }
      }}
    />
  );
};

export default OcelSelect;
