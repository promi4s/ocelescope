import {
  useDeleteOcel,
  useGetOcels,
  useRenameOcel,
} from "@/api/fastapi/ocels/ocels";
import {
  useDeleteResource,
  useRenameResource,
  useResources,
} from "@/api/fastapi/resources/resources";
import { formatDateTime } from "@/util/formatters";
import { DataTable } from "mantine-datatable";
import { useCallback, useMemo, useState } from "react";
import UploadSection from "../UploadSection/UploadSection";
import {
  ActionIcon,
  Badge,
  Group,
  Menu,
  TextInput,
  Title,
} from "@mantine/core";
import {
  Check,
  Download,
  EllipsisVerticalIcon,
  Pencil,
  Trash,
  X,
} from "lucide-react";
import useInvalidate from "@/hooks/useInvalidateResources";
import dayjs from "dayjs";
import uniqolor from "uniqolor";

type Entity = {
  type: "ocel" | "resource";
  entityTypes: string[];
  id: string;
  name: string;
  createdAt: string;
  downloadFormats?: string[];
};

const EntityTable: React.FC = () => {
  const { data: ocels = [] } = useGetOcels();
  const { data: resources = [] } = useResources();

  const invalidate = useInvalidate();

  const { mutate: deleteResource } = useDeleteResource({
    mutation: { onSuccess: () => invalidate(["resources"]) },
  });
  const { mutate: deleteOcel } = useDeleteOcel({
    mutation: { onSuccess: () => invalidate(["ocels"]) },
  });

  const { mutate: renameOcel } = useRenameOcel({
    mutation: { onSuccess: () => invalidate(["ocels"]) },
  });
  const { mutate: renameResource } = useRenameResource({
    mutation: { onSuccess: () => invalidate(["resources"]) },
  });

  const deleteEntity = useCallback(
    (id: string, entityType: Entity["type"]) => {
      switch (entityType) {
        case "ocel":
          deleteOcel({ params: { ocel_id: id } });
        case "resource":
          deleteResource({ resourceId: id });
      }
    },
    [deleteResource, deleteOcel],
  );
  const renameEntitiy = useCallback(
    (id: string, entityType: Entity["type"], newName: string) => {
      switch (entityType) {
        case "ocel":
          renameOcel({ params: { ocel_id: id, new_name: newName } });
        case "resource":
          renameResource({ resourceId: id, params: { new_name: newName } });
      }
    },
    [renameOcel, renameResource],
  );

  const [renamedEntitiy, setRenamedEntitiy] = useState<
    { id: string; value: string } | undefined
  >(undefined);

  const entities: Entity[] = useMemo(() => {
    const ocelEntities = ocels.map<Entity>(
      ({ name, created_at, id, extensions }) => ({
        id,
        name,
        type: "ocel" as const,
        entityTypes: extensions.map(({ label }) => label),
        createdAt: formatDateTime(created_at),
        downloadFormats: [".xml", ".json", ".sqlite"],
      }),
    );

    const resourceEntities = resources.map<Entity>(
      ({ id, name, type, created_at }) => ({
        id,
        name,
        entityTypes: [type],
        type: "resource",
        createdAt: formatDateTime(dayjs(created_at).toISOString()),
      }),
    );

    return [...ocelEntities, ...resourceEntities];
  }, [ocels, resources]);

  return (
    <>
      {entities.length ? (
        <DataTable<Entity>
          withTableBorder
          borderRadius={"md"}
          columns={[
            {
              accessor: "name",
              render: ({ id, type, name }) => (
                <>
                  {renamedEntitiy?.id === id ? (
                    <Group>
                      <TextInput
                        variant={"unstyled"}
                        value={renamedEntitiy.value}
                        style={{
                          borderBottom: "1px solid #9ca3af",
                        }}
                        onChange={(e) => {
                          setRenamedEntitiy({ id, value: e.target.value });
                        }}
                      />
                      <Group gap={"xs"}>
                        <ActionIcon
                          color="green"
                          m={0}
                          onClick={() => {
                            renameEntitiy(id, type, renamedEntitiy.value);
                            setRenamedEntitiy(undefined);
                          }}
                        >
                          <Check size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color="red"
                          m={0}
                          onClick={() => {
                            setRenamedEntitiy(undefined);
                          }}
                        >
                          <X size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  ) : (
                    name
                  )}
                </>
              ),
            },
            { accessor: "createdAt" },
            {
              accessor: "entityTypes",
              title: "Type",
              render: ({ type, entityTypes }) => (
                <Group gap={"xs"}>
                  {[...(type === "ocel" ? ["OCEL"] : []), ...entityTypes].map(
                    (entityType) => (
                      <Badge color={uniqolor(entityType).color}>
                        {entityType.toUpperCase()}
                      </Badge>
                    ),
                  )}
                </Group>
              ),
            },
            {
              accessor: "",
              textAlign: "right",
              width: "0%",
              render: ({ type, id, name, downloadFormats }) => (
                <Menu width={200} position="left-start">
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <EllipsisVerticalIcon size={20} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                    <Menu.Item
                      leftSection={<Pencil size={16} />}
                      onClick={() => setRenamedEntitiy({ id, value: name })}
                    >
                      Rename
                    </Menu.Item>

                    <Menu.Sub>
                      <Menu.Sub.Target>
                        <Menu.Sub.Item leftSection={<Download size={16} />}>
                          Download
                        </Menu.Sub.Item>
                      </Menu.Sub.Target>

                      <Menu.Sub.Dropdown></Menu.Sub.Dropdown>
                    </Menu.Sub>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={<Trash size={16} color={"red"} />}
                      color="red"
                      fw="bold"
                      onClick={() => deleteEntity(id, type)}
                    >
                      Delete
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              ),
            },
          ]}
          records={entities}
        />
      ) : (
        <>
          <Title size={"h3"}>Upload</Title>
          <UploadSection />
        </>
      )}
    </>
  );
};

export default EntityTable;
