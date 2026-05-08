import {
  ActionIcon,
  Badge,
  Group,
  Loader,
  Menu,
  MenuItem,
  TextInput,
  Title,
} from "@mantine/core";
import { generateColor } from "@marko19907/string-to-color";
import {
  useDeleteOcel,
  useDeleteResource,
  useGetOcels,
  useGetResourceMeta,
  useGetSystemTasks,
  useRenameOcel,
  useRenameResource,
  useResources,
} from "@ocelescope/api-base";
import { ResourceModal } from "@ocelescope/resources";
import {
  CheckIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { DataTable } from "mantine-datatable";
import { useCallback, useMemo, useState } from "react";
import { useDownloadFile } from "../../hooks/useDownload";
import useInvalidate from "../../hooks/useInvalidate";
import dayjs, { formatDateTime } from "../../lib/dayjs";
import UploadSection from "../UploadSection/UploadSection";

type Entity = {
  type: "ocel" | "resource";
  resourceType?: string;
  entityTypes: string[];
  id: string;
  name: string;
  createdAt: string;
  downloadFormats?: string[];
  isUploading?: boolean;
};

//TODO: sync with api
const ocelExtenisions = [".sqlite", ".xml", ".json"] as const;

const EntityTable: React.FC = () => {
  const { data: ocels = [] } = useGetOcels();
  const { data: resources = [] } = useResources();

  const { data: tasks = [] } = useGetSystemTasks({
    only_running: true,
    task_name: "importOCEL",
  });

  const invalidate = useInvalidate();
  const downloadFile = useDownloadFile();
  const { data: resourceMeta = {} } = useGetResourceMeta();

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
          deleteOcel({ ocelId: id });
          break;
        case "resource":
          deleteResource({ resourceId: id });
          break;
      }
    },
    [deleteResource, deleteOcel],
  );
  const renameEntitiy = useCallback(
    (id: string, entityType: Entity["type"], newName: string) => {
      switch (entityType) {
        case "ocel":
          renameOcel({ ocelId: id, params: { new_name: newName } });
          break;
        case "resource":
          renameResource({ resourceId: id, params: { new_name: newName } });
      }
    },
    [renameOcel, renameResource],
  );

  const [renamedEntitiy, setRenamedEntitiy] = useState<
    { id: string; value: string } | undefined
  >(undefined);

  const [viewedResouce, setViewedResource] = useState<string | undefined>();

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
        entityTypes: [resourceMeta[type]?.label ?? type],
        type: "resource" as const,
        resourceType: type,
        createdAt: formatDateTime(dayjs(created_at).toISOString()),
      }),
    );

    const taskEntity = tasks.map<Entity>(({ id, metadata }) => ({
      id: id,
      createdAt: metadata.uploaded_at as string,
      name: metadata.fileName as string,
      entityTypes: [],
      type: "ocel",
      isUploading: true,
    }));

    return [...ocelEntities, ...resourceEntities, ...taskEntity];
  }, [ocels, resources, tasks, resourceMeta]);

  return (
    <>
      {viewedResouce && (
        <ResourceModal
          id={viewedResouce}
          onClose={() => setViewedResource(undefined)}
        />
      )}
      {entities.length ? (
        <DataTable<Entity>
          withTableBorder
          borderRadius={"md"}
          idAccessor={"id"}
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
                          <CheckIcon size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color="red"
                          m={0}
                          onClick={() => {
                            setRenamedEntitiy(undefined);
                          }}
                        >
                          <XIcon size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  ) : (
                    name
                  )}
                </>
              ),
            },
            {
              accessor: "createdAt",
              render: ({ createdAt, isUploading }) =>
                isUploading ? "uploading" : formatDateTime(createdAt),
            },
            {
              accessor: "entityTypes",
              title: "Type",
              render: ({ type, entityTypes }) => (
                <Group gap={"xs"}>
                  {[...(type === "ocel" ? ["OCEL"] : []), ...entityTypes].map(
                    (entityType) => (
                      <Badge key={entityType} color={generateColor(entityType)}>
                        {entityType}
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
              //TODO: Maybe put this into its own component it is getting way to big
              render: ({ type, resourceType, id, name, isUploading }) =>
                isUploading ? (
                  <Loader size={20} />
                ) : (
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
                        leftSection={<PencilIcon size={16} />}
                        onClick={() => setRenamedEntitiy({ id, value: name })}
                      >
                        Rename
                      </Menu.Item>
                      {type === "resource" && (
                        <MenuItem
                          leftSection={<EyeIcon size={16} />}
                          onClick={() => setViewedResource(id)}
                        >
                          Inspect
                        </MenuItem>
                      )}
                      {type === "ocel" ? (
                        <Menu.Sub position="right-start">
                          <Menu.Sub.Target>
                            <Menu.Sub.Item
                              leftSection={<DownloadIcon size={16} />}
                            >
                              Download
                            </Menu.Sub.Item>
                          </Menu.Sub.Target>
                          <Menu.Sub.Dropdown>
                            {ocelExtenisions.map((extension) => (
                              <Menu.Item
                                key={extension}
                                onClick={() =>
                                  downloadFile(
                                    `/ocels/${id}/download?${new URLSearchParams({ ocel_id: id, ext: extension }).toString()}`,
                                  )
                                }
                              >
                                {extension}
                              </Menu.Item>
                            ))}
                          </Menu.Sub.Dropdown>
                        </Menu.Sub>
                      ) : resourceType === "PetriNet" ? (
                        <Menu.Sub position="right-start">
                          <Menu.Sub.Target>
                            <Menu.Sub.Item
                              leftSection={<DownloadIcon size={16} />}
                            >
                              Download
                            </Menu.Sub.Item>
                          </Menu.Sub.Target>
                          <Menu.Sub.Dropdown>
                            <Menu.Item
                              onClick={() =>
                                downloadFile(
                                  `/resources/resource/${id}/download`,
                                )
                              }
                            >
                              .ocelescope
                            </Menu.Item>
                            <Menu.Item
                              onClick={() =>
                                downloadFile(
                                  `/resources/resource/${id}/download/pnml`,
                                )
                              }
                            >
                              .pnml
                            </Menu.Item>
                          </Menu.Sub.Dropdown>
                        </Menu.Sub>
                      ) : (
                        <Menu.Item
                          onClick={() =>
                            downloadFile(`/resources/resource/${id}/download`)
                          }
                          leftSection={<DownloadIcon size={16} />}
                        >
                          Download
                        </Menu.Item>
                      )}
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<TrashIcon size={16} color={"red"} />}
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
