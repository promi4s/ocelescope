import { Button, Divider, LoadingOverlay, Stack } from "@mantine/core";
import {
  useGetDefaultOcel,
  useImportDefaultOcel,
  useImportOcel,
} from "@/api/fastapi/ocels/ocels";
import { Container as ContainerIcon } from "lucide-react";
import FileDropzone from "@/components/Dropzone/Dropzone";

const OcelUpload: React.FC<{ onUpload: () => void }> = ({ onUpload }) => {
  const { data: defaultOcels } = useGetDefaultOcel({
    only_latest_versions: true,
  });

  const { mutate: importDefaultOcel, isPending: isDefaultImportPending } =
    useImportDefaultOcel({
      mutation: {
        onSuccess: onUpload,
      },
    });

  const { mutate, isPending: isImportPending } = useImportOcel({
    mutation: { onSuccess: onUpload },
  });

  return (
    <>
      <LoadingOverlay visible={isImportPending || isDefaultImportPending} />
      <FileDropzone
        onUpload={(file) =>
          mutate({ data: { file: file[0] }, params: { name: file[0].name } })
        }
        accept={{
          "application/json": [".json", ".jsonocel"],
          "application/xml": [".xml", ".xmlocel"],
          "application/x-sqlite3": [".sqlite"],
        }}
        content={{
          accept: "Drop files here",
          idle: "Upload OCEL",
          reject: "Not supported file format",
          description: (
            <>
              Drag&apos;n&apos;drop files here to upload. We can accept only
              <i>.sqlite, .json, .xml </i> files.
            </>
          ),
        }}
      />
      <Stack gap={0} mt="lg" w={"100%"}>
        <Divider />
        {defaultOcels?.map((ocel) => (
          <>
            <Button
              variant="subtle"
              p={0}
              onClick={() => importDefaultOcel({ params: { key: ocel.key } })}
              leftSection={<ContainerIcon />}
              rightSection={ocel.version}
              justify="space-between"
              fullWidth
            >
              {ocel.name}
            </Button>
            <Divider />
          </>
        ))}
      </Stack>
    </>
  );
};

export default OcelUpload;
