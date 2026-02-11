import { DataTable } from "mantine-datatable";
import { useGetDefaultOcel, useImportDefaultOcel } from "../../api/coreApi";
import { ThemeIcon } from "@mantine/core";
import { ContainerIcon } from "lucide-react";
import useInvalidate from "../../hooks/useInvalidate";

const DefaultOcels: React.FC = () => {
  const { data: ocels = [] } = useGetDefaultOcel({});

  const invalidate = useInvalidate();

  const { mutate: uploadDefault } = useImportDefaultOcel({
    mutation: {
      onSuccess: async () => {
        await invalidate(["ocels"]);
      },
    },
  });

  return (
    <DataTable
      noHeader
      records={ocels}
      highlightOnHover
      idAccessor={"key"}
      withRowBorders={false}
      onRowClick={({ record }) => uploadDefault({ params: { ...record } })}
      columns={[
        {
          accessor: "",
          render: () => (
            <ThemeIcon variant="transparent">
              <ContainerIcon />
            </ThemeIcon>
          ),
        },
        { accessor: "name" },
        {
          accessor: "version",
          textAlign: "right",
          render: ({ version }) => `v${version}`,
        },
      ]}
    />
  );
};

const UploadSection: React.FC = () => {
  return <DefaultOcels />;
};

export default UploadSection;
