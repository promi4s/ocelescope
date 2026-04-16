import {
  ActionIcon,
  Badge,
  Button,
  Group,
  LoadingOverlay,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { DataTable, type DataTableColumn } from "mantine-datatable";
import { useCallback, useMemo, useState } from "react";
import {
  BoxIcon,
  Calendar1Icon,
  ChevronDown,
  ChevronRight,
  ListTreeIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  ShapesIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import {
  useAddCategoryAssignment,
  useAddLabelAssignment,
  useCreateCategory,
  useCreateLabel,
  useDeleteCategory,
  useDeleteLabel,
  useGetCategoriesWithAssignments,
  useGetLabelsWithAssignments,
  useRemoveCategoryAssignment,
  useRemoveLabelAssignment,
  useRenameCategory,
  useRenameLabel,
  type CategoryDefinition,
  type CategoryWithAssignments,
  type LabelDefinition,
  type LabelWithAssignments,
} from "@ocelescope/api-base";
import AssignmentModal from "./AssignmentModal";
import DefinitionModal from "./DefinitionModal";
import type { AnnotationElementType, AnnotationKind } from "./types";

type AnnotationRecord =
  | {
      kind: "labels";
      definition: LabelDefinition;
      rows: Array<{ element_ref: string }>;
    }
  | {
      kind: "categories";
      definition: CategoryDefinition;
      rows: Array<{ element_ref: string; value: string }>;
    };

const elementTypeIconMap: Record<
  string,
  React.ComponentType<{ size?: number }>
> = {
  event: Calendar1Icon,
  activity: Calendar1Icon,
  object: BoxIcon,
  object_type: ShapesIcon,
  item_type: PackageIcon,
};

const prettifyElementType = (value: string) => {
  switch (value) {
    case "event":
      return "Event";
    case "activity":
      return "Activity";
    case "object":
      return "Object";
    case "object_type":
      return "Object Type";
    case "item_type":
      return "Item Type";
    default:
      return value;
  }
};

const normalizeLabelRows = (item: any): Array<{ element_ref: string }> => {
  const candidates = [
    item?.assignments,
    item?.members,
    item?.memberships,
    item?.label_assignments,
    item?.rows,
    item?.asssignments,
  ];

  const raw = candidates.find(Array.isArray) ?? [];

  return raw
    .map((row: any) => ({
      element_ref:
        row?.element_ref ??
        row?.elementRef ??
        row?.ann_element_ref ??
        row?.["ann:element_ref"] ??
        "",
    }))
    .filter((row: { element_ref: string }) => row.element_ref);
};

const normalizeCategoryRows = (
  item: any,
): Array<{ element_ref: string; value: string }> => {
  const candidates = [
    item?.assignments,
    item?.category_assignments,
    item?.rows,
  ];

  const raw = candidates.find(Array.isArray) ?? [];

  return raw
    .map((row: any) => ({
      element_ref:
        row?.element_ref ??
        row?.elementRef ??
        row?.ann_element_ref ??
        row?.["ann:element_ref"] ??
        "",
      value:
        row?.value ??
        row?.category_value ??
        row?.categoryValue ??
        row?.["ann:category_value"] ??
        "",
    }))
    .filter((row: { element_ref: string; value: string }) => row.element_ref);
};

const AnnotationSection: React.FC<{
  ocelId: string;
  kind: AnnotationKind;
}> = ({ ocelId, kind }) => {
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [selectedDefinition, setSelectedDefinition] = useState<
    AnnotationRecord["definition"] | null
  >(null);
  const [selectedCategoryAssignment, setSelectedCategoryAssignment] = useState<{
    element_ref: string;
    value: string;
  } | null>(null);

  const [createOpened, createHandlers] = useDisclosure(false);
  const [renameOpened, renameHandlers] = useDisclosure(false);
  const [assignmentOpened, assignmentHandlers] = useDisclosure(false);

  const labelsQuery = useGetLabelsWithAssignments(ocelId);
  const categoriesQuery = useGetCategoriesWithAssignments(ocelId);

  const createLabelMutation = useCreateLabel();
  const renameLabelMutation = useRenameLabel();
  const deleteLabelMutation = useDeleteLabel();
  const addLabelAssignmentMutation = useAddLabelAssignment();
  const removeLabelAssignmentMutation = useRemoveLabelAssignment();

  const createCategoryMutation = useCreateCategory();
  const renameCategoryMutation = useRenameCategory();
  const deleteCategoryMutation = useDeleteCategory();
  const addCategoryAssignmentMutation = useAddCategoryAssignment();
  const removeCategoryAssignmentMutation = useRemoveCategoryAssignment();

  const refetch = useCallback(async () => {
    await Promise.all([labelsQuery.refetch(), categoriesQuery.refetch()]);
  }, [labelsQuery, categoriesQuery]);

  const records = useMemo<AnnotationRecord[]>(() => {
    if (kind === "labels") {
      return (labelsQuery.data ?? []).map(
        (item: LabelWithAssignments | any) => ({
          kind: "labels",
          definition: item.definition,
          rows: normalizeLabelRows(item),
        }),
      );
    }

    return (categoriesQuery.data ?? []).map(
      (item: CategoryWithAssignments | any) => ({
        kind: "categories",
        definition: item.definition,
        rows: normalizeCategoryRows(item),
      }),
    );
  }, [kind, labelsQuery.data, categoriesQuery.data]);

  const fetching =
    kind === "labels" ? labelsQuery.isLoading : categoriesQuery.isLoading;
  const error = kind === "labels" ? labelsQuery.error : categoriesQuery.error;

  const toggleExpanded = useCallback((definitionId: number) => {
    setExpandedIds((prev) =>
      prev.includes(definitionId)
        ? prev.filter((id) => id !== definitionId)
        : [...prev, definitionId],
    );
  }, []);

  const handleCreate = useCallback(
    async (values: { name: string; element_type?: AnnotationElementType }) => {
      if (!values.element_type) return;

      if (kind === "labels") {
        await createLabelMutation.mutateAsync({
          ocelId,
          data: {
            name: values.name,
            element_type: values.element_type,
          },
        });
      } else {
        await createCategoryMutation.mutateAsync({
          ocelId,
          data: {
            name: values.name,
            element_type: values.element_type,
          },
        });
      }

      await refetch();
    },
    [kind, ocelId, createLabelMutation, createCategoryMutation, refetch],
  );

  const handleRename = useCallback(
    async (values: { name: string }) => {
      if (!selectedDefinition) return;

      if (kind === "labels") {
        await renameLabelMutation.mutateAsync({
          ocelId,
          labelId: selectedDefinition.id,
          data: { name: values.name },
        });
      } else {
        await renameCategoryMutation.mutateAsync({
          ocelId,
          categoryId: selectedDefinition.id,
          data: { name: values.name },
        });
      }

      await refetch();
      renameHandlers.close();
    },
    [
      kind,
      ocelId,
      selectedDefinition,
      renameLabelMutation,
      renameCategoryMutation,
      refetch,
      renameHandlers,
    ],
  );

  const handleDelete = useCallback(
    async (definition: AnnotationRecord["definition"]) => {
      if (kind === "labels") {
        await deleteLabelMutation.mutateAsync({
          ocelId,
          labelId: definition.id,
        });
      } else {
        await deleteCategoryMutation.mutateAsync({
          ocelId,
          categoryId: definition.id,
        });
      }

      await refetch();
      setExpandedIds((prev) => prev.filter((id) => id !== definition.id));
    },
    [kind, ocelId, deleteLabelMutation, deleteCategoryMutation, refetch],
  );

  const handleSubmitAssignment = useCallback(
    async (values: { element_refs: string[]; value?: string }) => {
      if (!selectedDefinition) return;

      if (kind === "labels") {
        await Promise.all(
          values.element_refs.map((elementRef) =>
            addLabelAssignmentMutation.mutateAsync({
              ocelId,
              labelId: selectedDefinition.id,
              data: { element_ref: elementRef },
            }),
          ),
        );
      } else {
        await Promise.all(
          values.element_refs.map((elementRef) =>
            addCategoryAssignmentMutation.mutateAsync({
              ocelId,
              categoryId: selectedDefinition.id,
              data: {
                element_ref: elementRef,
                value: values.value ?? "",
              },
            }),
          ),
        );
      }

      await refetch();
      assignmentHandlers.close();
      setExpandedIds((prev) =>
        prev.includes(selectedDefinition.id)
          ? prev
          : [...prev, selectedDefinition.id],
      );
    },
    [
      selectedDefinition,
      kind,
      ocelId,
      addLabelAssignmentMutation,
      addCategoryAssignmentMutation,
      refetch,
      assignmentHandlers,
    ],
  );

  const handleRemoveLabelAssignment = useCallback(
    async (labelId: number, elementRef: string) => {
      await removeLabelAssignmentMutation.mutateAsync({
        ocelId,
        labelId,
        data: { element_ref: elementRef },
      });

      await refetch();
    },
    [removeLabelAssignmentMutation, ocelId, refetch],
  );

  const handleRemoveCategoryAssignment = useCallback(
    async (categoryId: number, elementRef: string) => {
      await removeCategoryAssignmentMutation.mutateAsync({
        ocelId,
        categoryId,
        data: { element_ref: elementRef },
      });

      await refetch();
    },
    [removeCategoryAssignmentMutation, ocelId, refetch],
  );

  const openRenameModal = useCallback(
    (definition: AnnotationRecord["definition"]) => {
      createHandlers.close();
      assignmentHandlers.close();
      setSelectedCategoryAssignment(null);
      setSelectedDefinition(definition);
      renameHandlers.open();
    },
    [createHandlers, assignmentHandlers, renameHandlers],
  );

  const openAssignmentModal = useCallback(
    (
      definition: AnnotationRecord["definition"],
      assignment?: { element_ref: string; value: string } | null,
    ) => {
      createHandlers.close();
      renameHandlers.close();
      setSelectedDefinition(definition);
      setSelectedCategoryAssignment(assignment ?? null);
      assignmentHandlers.open();
    },
    [createHandlers, renameHandlers, assignmentHandlers],
  );

  const columns: DataTableColumn<AnnotationRecord>[] = [
    {
      accessor: "expand",
      title: "",
      width: 40,
      render: (record) => (
        <ActionIcon
          variant="subtle"
          onClick={(event) => {
            event.stopPropagation();
            toggleExpanded(record.definition.id);
          }}
        >
          {expandedIds.includes(record.definition.id) ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </ActionIcon>
      ),
    },
    {
      accessor: "name",
      title: kind === "labels" ? "Label" : "Category",
      render: (record) => {
        const Icon = kind === "labels" ? TagIcon : ListTreeIcon;
        return (
          <Group gap="xs">
            <ThemeIcon size="sm" variant="subtle">
              <Icon size={14} />
            </ThemeIcon>
            <Text fw={500}>{record.definition.name}</Text>
          </Group>
        );
      },
    },
    {
      accessor: "element_type",
      title: "Element Type",
      render: (record) => {
        const Icon =
          elementTypeIconMap[record.definition.element_type] ?? ShapesIcon;

        return (
          <Group gap="xs">
            <Tooltip label={record.definition.element_type}>
              <ThemeIcon size="sm" variant="subtle">
                <Icon size={14} />
              </ThemeIcon>
            </Tooltip>
            <Text>{prettifyElementType(record.definition.element_type)}</Text>
          </Group>
        );
      },
    },
    {
      accessor: "size",
      title: "Assignments",
      textAlign: "right",
      render: (record) => record.rows.length,
    },
    ...(kind === "categories"
      ? [
          {
            accessor: "distinct_values",
            title: "Distinct Values",
            textAlign: "right" as const,
            render: (record: AnnotationRecord) => {
              if (record.kind !== "categories") return 0;
              return new Set(record.rows.map((row) => row.value)).size;
            },
          } satisfies DataTableColumn<AnnotationRecord>,
        ]
      : []),
    {
      accessor: "actions",
      title: "",
      width: 140,
      render: (record) => (
        <Group gap="xs" wrap="nowrap">
          <Tooltip label="Rename">
            <ActionIcon
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation();
                openRenameModal(record.definition);
              }}
            >
              <PencilIcon size={16} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Add assignment">
            <ActionIcon
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation();
                openAssignmentModal(record.definition);
              }}
            >
              <PlusIcon size={16} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Delete">
            <ActionIcon
              color="red"
              variant="subtle"
              onClick={async (event) => {
                event.stopPropagation();
                await handleDelete(record.definition);
              }}
            >
              <Trash2Icon size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  const rowExpansion = {
    allowMultiple: true,
    expanded: {
      recordIds: expandedIds,
      onRecordIdsChange: (recordIds: (string | number)[]) =>
        setExpandedIds(recordIds.map(Number)),
    },
    content: ({ record }: { record: AnnotationRecord }) => {
      if (record.rows.length === 0) {
        return (
          <Stack gap="xs" p="sm">
            <Text c="dimmed" size="sm">
              No assignments yet.
            </Text>
          </Stack>
        );
      }

      if (record.kind === "labels") {
        return (
          <Stack gap="xs" p="sm" mx="lg">
            {record.rows.map((row, index) => (
              <Group
                key={`${record.definition.id}:${row.element_ref}:${index}`}
                justify="space-between"
              >
                <Badge variant="filled">{row.element_ref}</Badge>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  onClick={async () => {
                    await handleRemoveLabelAssignment(
                      record.definition.id,
                      row.element_ref,
                    );
                  }}
                >
                  <Trash2Icon size={14} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        );
      }

      return (
        <Stack gap="xs" p="sm" mx="lg">
          {record.rows.map((row, index) => (
            <Group
              key={`${record.definition.id}:${row.element_ref}:${index}`}
              justify="space-between"
            >
              <Group gap="xs">
                <Badge variant="filled">{row.element_ref}</Badge>
                <Text size="sm">{row.value}</Text>
              </Group>

              <Group gap={4}>
                <ActionIcon
                  variant="subtle"
                  onClick={() => {
                    openAssignmentModal(record.definition, row);
                  }}
                >
                  <PencilIcon size={14} />
                </ActionIcon>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  onClick={async () => {
                    await handleRemoveCategoryAssignment(
                      record.definition.id,
                      row.element_ref,
                    );
                  }}
                >
                  <Trash2Icon size={14} />
                </ActionIcon>
              </Group>
            </Group>
          ))}
        </Stack>
      );
    },
  };

  if (error) {
    return (
      <Text c="red" size="sm">
        Failed to load {kind}.
      </Text>
    );
  }

  return (
    <>
      <Stack gap="xs" pos="relative">
        {fetching && <LoadingOverlay visible />}

        <Group justify="flex-end">
          <Button
            size="xs"
            variant="light"
            onClick={() => {
              renameHandlers.close();
              assignmentHandlers.close();
              setSelectedDefinition(null);
              setSelectedCategoryAssignment(null);
              createHandlers.open();
            }}
          >
            Create
          </Button>
        </Group>

        <DataTable
          idAccessor={(record) => record.definition.id}
          minHeight={180}
          withTableBorder
          highlightOnHover
          records={records}
          columns={columns}
          rowExpansion={rowExpansion}
          emptyState={
            <Stack align="center" gap="xs" py="md">
              <Text c="dimmed" size="sm">
                {kind === "labels"
                  ? "No labels have been created yet."
                  : "No categories have been created yet."}
              </Text>
            </Stack>
          }
        />
      </Stack>

      <DefinitionModal
        opened={createOpened}
        onClose={createHandlers.close}
        kind={kind}
        mode="create"
        onSubmit={handleCreate}
      />

      <DefinitionModal
        opened={renameOpened}
        onClose={renameHandlers.close}
        kind={kind}
        mode="rename"
        initialName={selectedDefinition?.name}
        initialElementType={
          selectedDefinition?.element_type as AnnotationElementType | undefined
        }
        onSubmit={handleRename}
      />

      <AssignmentModal
        opened={assignmentOpened}
        onClose={assignmentHandlers.close}
        ocelId={ocelId}
        kind={kind}
        elementType={
          selectedDefinition?.element_type as AnnotationElementType | undefined
        }
        initialElementRef={selectedCategoryAssignment?.element_ref}
        initialValue={selectedCategoryAssignment?.value}
        onSubmit={handleSubmitAssignment}
      />
    </>
  );
};

export default AnnotationSection;
