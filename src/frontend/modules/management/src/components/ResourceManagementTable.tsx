import {
  ActionIcon,
  Badge,
  Group,
  Loader,
  Menu,
  MenuItem,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { generateColor } from "@marko19907/string-to-color";
import {
  useDeleteOcel,
  useDeleteResource,
  useGetOcels,
  useGetSystemTasks,
  useRenameOcel,
  useRenameResource,
  useResources,
} from "@ocelescope/api-base";
import {
  FullScreenUpload,
  UploadSection,
  useDownloadOCEL,
  useDownloadResource,
  useDownloadResourceAsPnml,
  useInvalidate,
} from "@ocelescope/core";
import { ResourceModal } from "@ocelescope/resources";
import {
  CheckIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  FilterIcon,
  PencilIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useCallback, useMemo, useState } from "react";
import dayjs, { formatDateTime } from "../util/dayjs";
import { XESExportWindow } from "./XESExportWindow";
import { useDebouncedValue } from "@mantine/hooks";

type Entity = {
  type: "ocel" | "resource";
  entityTypeName: string;
  id: string;
  name: string;
  createdAt: string;
  downloadFormats?: string[];
  isFiltered?: boolean;
  isUploading?: boolean;
};

//TODO: sync with api
const ocelExtensions = [".sqlite", ".xml", ".json"] as const;

const ResourceManagementTable: React.FC = () => {
  const { data: ocels = [] } = useGetOcels();
  const { data: resources = [] } = useResources();

  const { data: tasks = [] } = useGetSystemTasks({
    only_running: true,
    task_names: ["importOCEL", "importXES"],
  });

  const invalidate = useInvalidate();

  const [exportOcelId, setExportOcelId] = useState<string | undefined>(
    undefined,
  );

  const { download: downloadOCEL } = useDownloadOCEL();
  const { download: downloadResource } = useDownloadResource();
  const { download: downloadResourceAsPnml } = useDownloadResourceAsPnml();

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
  const renameEntity = useCallback(
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

  const [renamedEntity, setRenamedEntity] = useState<
    { id: string; value: string } | undefined
  >(undefined);

  const [viewedResource, setViewedResource] = useState<string | undefined>();

  const [searchedName, setSearchedName] = useState<string | null>(null);
  const [debouncedSearch] = useDebouncedValue(searchedName, 200);

  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<Entity>>({
    columnAccessor: "createdAt",
    direction: "desc",
  });

  const entities: Entity[] = useMemo(() => {
    const ocelEntities = ocels.map<Entity>(
      ({ name, created_at, id, filter_applied }) => ({
        id,
        name,
        type: "ocel" as const,
        entityTypeName: "OCEL",
        createdAt: formatDateTime(created_at),
        downloadFormats: [".xml", ".json", ".sqlite"],
        isFiltered: !!filter_applied,
      }),
    );

    const resourceEntities = resources.map<Entity>(
      ({ id, name, resource_type_label, schema_hash, created_at }) => ({
        id,
        name,
        entityTypeName: resource_type_label,
        type: "resource" as const,
        resourceType: schema_hash,
        createdAt: formatDateTime(dayjs(created_at).toISOString()),
      }),
    );

    const taskEntity = tasks.map<Entity>(({ id, metadata }) => ({
      id: id,
      createdAt: formatDateTime(metadata.uploaded_at as string),
      name: metadata.fileName as string,
      entityTypeName: "OCEL",
      type: "ocel",
      isUploading: true,
    }));

    const { columnAccessor, direction } = sortStatus;
    const sign = direction === "desc" ? -1 : 1;
    return [...ocelEntities, ...resourceEntities, ...taskEntity]
      .filter(
        ({ name }) =>
          !debouncedSearch ||
          name
            .trim()
            .toLowerCase()
            .includes(debouncedSearch.toLowerCase().trim()),
      )
      .sort(
        (a, b) =>
          sign *
          String(a[columnAccessor as keyof Entity] ?? "").localeCompare(
            String(b[columnAccessor as keyof Entity] ?? ""),
          ),
      );
  }, [ocels, resources, tasks, sortStatus, debouncedSearch]);

  return (
    <>
      {viewedResource && (
        <ResourceModal
          id={viewedResource}
          onClose={() => setViewedResource(undefined)}
        />
      )}
      <XESExportWindow
        key={exportOcelId}
        ocelId={exportOcelId}
        onClose={() => setExportOcelId(undefined)}
      />
      {entities.length ? (
        <>
          <FullScreenUpload />
          <DataTable<Entity>
            withTableBorder
            borderRadius={"md"}
            idAccessor={"id"}
            columns={[
              {
                accessor: "name",
                sortable: true,
                filter: (
                  <TextInput
                    placeholder="Search by name ..."
                    leftSection={<SearchIcon size={16} />}
                    rightSection={
                      <ActionIcon
                        size={"sm"}
                        variant="transparent"
                        c="dimmed"
                        onClick={() => setSearchedName(null)}
                      >
                        <XIcon size={14} />
                      </ActionIcon>
                    }
                    value={searchedName ?? ""}
                    onChange={(value) =>
                      setSearchedName(value.currentTarget.value ?? null)
                    }
                  />
                ),
                filtering: !!searchedName,
                render: ({ id, type, name, isFiltered }) => (
                  <>
                    {renamedEntity?.id === id ? (
                      <Group>
                        <TextInput
                          variant={"unstyled"}
                          value={renamedEntity.value}
                          style={{
                            borderBottom: "1px solid #9ca3af",
                          }}
                          onChange={(e) => {
                            setRenamedEntity({ id, value: e.target.value });
                          }}
                        />
                        <Group gap={"xs"}>
                          <ActionIcon
                            color="green"
                            m={0}
                            onClick={() => {
                              renameEntity(id, type, renamedEntity.value);
                              setRenamedEntity(undefined);
                            }}
                          >
                            <CheckIcon size={16} />
                          </ActionIcon>
                          <ActionIcon
                            color="red"
                            m={0}
                            onClick={() => {
                              setRenamedEntity(undefined);
                            }}
                          >
                            <XIcon size={16} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    ) : (
                      <Group gap={6} wrap="nowrap">
                        {name}
                        {isFiltered && (
                          <Tooltip label="This log has been filtered">
                            <FilterIcon
                              size={14}
                              color="var(--mantine-color-blue-6)"
                            />
                          </Tooltip>
                        )}
                      </Group>
                    )}
                  </>
                ),
              },
              {
                accessor: "createdAt",
                sortable: true,
                render: ({ createdAt, isUploading }) =>
                  isUploading ? "uploading" : formatDateTime(createdAt),
              },
              {
                accessor: "entityTypeName",
                sortable: true,
                title: "Type",
                render: ({ entityTypeName }) => (
                  <Badge color={generateColor(entityTypeName)}>
                    {entityTypeName}
                  </Badge>
                ),
              },
              {
                accessor: "",
                textAlign: "right",
                width: "0%",
                //TODO: Maybe put this into its own component it is getting way to big
                render: ({ type, entityTypeName, id, name, isUploading }) =>
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
                          onClick={() => setRenamedEntity({ id, value: name })}
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
                              {ocelExtensions.map((extension) => (
                                <Menu.Item
                                  key={extension}
                                  onClick={() =>
                                    downloadOCEL(id, { ext: extension })
                                  }
                                >
                                  {extension}
                                </Menu.Item>
                              ))}
                              <Menu.Item
                                key={".xes"}
                                onClick={() => setExportOcelId(id)}
                              >
                                {".xes"}
                              </Menu.Item>
                            </Menu.Sub.Dropdown>
                          </Menu.Sub>
                        ) : entityTypeName === "Petri Net" ? (
                          <Menu.Sub position="right-start">
                            <Menu.Sub.Target>
                              <Menu.Sub.Item
                                leftSection={<DownloadIcon size={16} />}
                              >
                                Download
                              </Menu.Sub.Item>
                            </Menu.Sub.Target>
                            <Menu.Sub.Dropdown>
                              <Menu.Item onClick={() => downloadResource(id)}>
                                .ocelescope
                              </Menu.Item>
                              <Menu.Item
                                onClick={() => downloadResourceAsPnml(id)}
                              >
                                .pnml
                              </Menu.Item>
                            </Menu.Sub.Dropdown>
                          </Menu.Sub>
                        ) : (
                          <Menu.Item
                            onClick={() => downloadResource(id)}
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
            sortStatus={sortStatus}
            onSortStatusChange={setSortStatus}
            records={entities}
          />
        </>
      ) : (
        <>
          <Title size={"h3"}>Upload</Title>
          <UploadSection />
        </>
      )}
    </>
  );
};

export default ResourceManagementTable;
