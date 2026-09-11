import {
  ActionIcon,
  Badge,
  Group,
  MultiSelect,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
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
import { CheckIcon, FilterIcon, SearchIcon, XIcon } from "lucide-react";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortStatus,
} from "mantine-datatable";
import { useCallback, useMemo, useState } from "react";
import type { Entity } from "../types";
import dayjs, { formatDateTime } from "../util/dayjs";
import EntityActionsMenu, { type OcelExtension } from "./EntityActionsMenu";
import { XESExportWindow } from "./XESExportWindow";

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

  const allEntityTypes = useMemo(
    () => [
      ...(ocels.length > 0 || tasks.length > 0 ? ["OCEL"] : []),
      ...new Set(
        resources.map(({ resource_type_label }) => resource_type_label),
      ),
    ],
    [ocels, resources, tasks],
  );

  const [includedEntityTypes, setIncludedEntityTypes] = useState<string[]>([]);

  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<Entity>>({
    columnAccessor: "createdAt",
    direction: "desc",
  });

  const allEntities: Entity[] = useMemo(() => {
    const ocelEntities = ocels.map<Entity>(
      ({ name, created_at, id, filter_applied }) => ({
        id,
        name,
        type: "ocel" as const,
        entityTypeName: "OCEL",
        createdAt: dayjs(created_at).toISOString(),
        isFiltered: !!filter_applied,
      }),
    );

    const resourceEntities = resources.map<Entity>(
      ({ id, name, resource_type_label, created_at }) => ({
        id,
        name,
        entityTypeName: resource_type_label,
        type: "resource" as const,
        createdAt: dayjs(created_at).toISOString(),
      }),
    );

    const taskEntity = tasks.map<Entity>(({ id, metadata }) => ({
      id: id,
      createdAt: dayjs(metadata.uploaded_at as string).toISOString(),
      name: metadata.fileName as string,
      entityTypeName: "OCEL",
      type: "ocel",
      isUploading: true,
    }));

    return [...ocelEntities, ...resourceEntities, ...taskEntity];
  }, [ocels, resources, tasks]);

  const entities: Entity[] = useMemo(() => {
    const searchTerm = debouncedSearch?.trim().toLowerCase();
    const includedTypes = new Set(includedEntityTypes);

    const { columnAccessor, direction } = sortStatus;
    const sign = direction === "desc" ? -1 : 1;
    return allEntities
      .filter(
        ({ name, entityTypeName }) =>
          (!searchTerm || name.trim().toLowerCase().includes(searchTerm)) &&
          (includedTypes.size === 0 || includedTypes.has(entityTypeName)),
      )
      .sort(
        (a, b) =>
          sign *
          String(a[columnAccessor as keyof Entity] ?? "").localeCompare(
            String(b[columnAccessor as keyof Entity] ?? ""),
            undefined,
            { numeric: true, sensitivity: "base" },
          ),
      );
  }, [allEntities, sortStatus, debouncedSearch, includedEntityTypes]);

  const startRename = useCallback(
    ({ id, name }: Entity) => setRenamedEntity({ id, value: name }),
    [],
  );
  const downloadOcelAs = useCallback(
    (id: string, extension: OcelExtension) =>
      downloadOCEL(id, { ext: extension }),
    [downloadOCEL],
  );

  const columns = useMemo<DataTableColumn<Entity>[]>(
    () => [
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
                    <FilterIcon size={14} color="var(--mantine-color-blue-6)" />
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
        filter: (
          <MultiSelect
            placeholder="Filter by type ..."
            data={allEntityTypes}
            leftSection={<SearchIcon size={16} />}
            value={includedEntityTypes}
            onChange={setIncludedEntityTypes}
            clearable
            searchable
            maw={300}
            comboboxProps={{ withinPortal: false }}
            renderOption={({ option, checked }) => (
              <Group gap={"xs"} wrap="nowrap">
                {checked && <CheckIcon size={14} />}
                <Badge color={generateColor(option.value)}>
                  {option.label}
                </Badge>
              </Group>
            )}
            renderPill={({ option, onRemove, disabled }) => (
              <Badge
                color={generateColor(String(option.value))}
                style={{ cursor: disabled ? undefined : "pointer" }}
                rightSection={!disabled && <XIcon size={12} />}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onRemove?.();
                }}
              >
                {option.label}
              </Badge>
            )}
          />
        ),
        filtering: includedEntityTypes.length > 0,
        render: ({ entityTypeName }) => (
          <Badge color={generateColor(entityTypeName)}>{entityTypeName}</Badge>
        ),
      },
      {
        accessor: "",
        textAlign: "right",
        width: "0%",
        render: (entity) => (
          <EntityActionsMenu
            entity={entity}
            onRename={startRename}
            onInspect={setViewedResource}
            onDownloadOcel={downloadOcelAs}
            onExportAsXes={setExportOcelId}
            onDownloadResource={downloadResource}
            onDownloadResourceAsPnml={downloadResourceAsPnml}
            onDelete={deleteEntity}
          />
        ),
      },
    ],
    [
      searchedName,
      renamedEntity,
      renameEntity,
      allEntityTypes,
      includedEntityTypes,
      startRename,
      downloadOcelAs,
      downloadResource,
      downloadResourceAsPnml,
      deleteEntity,
    ],
  );

  const hasEntities = allEntityTypes.length > 0;

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
      {hasEntities ? (
        <>
          <FullScreenUpload />
          <DataTable<Entity>
            withTableBorder
            borderRadius={"md"}
            idAccessor={"id"}
            columns={columns}
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
