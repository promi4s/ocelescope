import {
  ActionIcon,
  Badge,
  Group,
  MultiSelect,
  Switch,
  Text,
  Tooltip,
} from "@mantine/core";
import { viewParams } from "@ocelescope/core";
import { keepPreviousData } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { DataTable, type DataTableColumn } from "mantine-datatable";
import { useMemo, useState } from "react";
import {
  type SharedAttribute,
  useGetSharedAttributes,
} from "../../../api/base";

type AttributeTableProps = {
  ocelId: string;
  viewId: string | null;
  entityType: "events" | "objects";
  types?: string[];
  added: string[];
  onAdd: (attribute: SharedAttribute) => void;
  onEdit: (attribute: string) => void;
  onRemove: (attribute: string) => void;
};

const listed = (names: string[]) => {
  const shown = names.slice(0, 2).join(", ");
  return names.length > 2 ? `${shown} +${names.length - 2} more` : shown;
};

const AttributeTable: React.FC<AttributeTableProps> = ({
  ocelId,
  viewId,
  entityType,
  types,
  added,
  onAdd,
  onEdit,
  onRemove,
}) => {
  const [searched, setSearched] = useState<string[]>([]);
  const [appliedOnly, setAppliedOnly] = useState(false);

  const { data, isFetching } = useGetSharedAttributes(
    ocelId,
    {
      ...viewParams(viewId),
      entity_type: entityType,
      ...(types && types.length > 0 && { entity_names: types }),
    },
    { query: { placeholderData: keepPreviousData } },
  );

  const names = useMemo(() => (data ?? []).map(({ name }) => name), [data]);

  const records = useMemo(
    () =>
      (data ?? []).filter(
        ({ name }) =>
          (searched.length === 0 || searched.includes(name)) &&
          (!appliedOnly || added.includes(name)),
      ),
    [data, searched, appliedOnly, added],
  );

  const columns = useMemo<DataTableColumn<SharedAttribute>[]>(
    () => [
      {
        accessor: "name",
        title: "Attribute",
        filter: () => (
          <MultiSelect
            data={names}
            value={searched}
            onChange={setSearched}
            placeholder="Search attributes…"
            comboboxProps={{ withinPortal: false }}
            clearable
            searchable
          />
        ),
        filtering: searched.length > 0,
        render: ({ name, type }) => (
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" fw={500}>
              {name}
            </Text>
            <Badge size="xs" variant="light">
              {type}
            </Badge>
          </Group>
        ),
      },
      {
        accessor: "entity_types",
        title: entityType === "events" ? "Activities" : "Object types",
        render: ({ entity_types }) => (
          <Text size="sm" c="dimmed">
            {listed(entity_types)}
          </Text>
        ),
      },
      {
        accessor: "actions",
        title: "",
        textAlign: "right",
        width: 110,
        filter: () => (
          <Switch
            label="Only applied"
            checked={appliedOnly}
            onChange={(event) => setAppliedOnly(event.currentTarget.checked)}
          />
        ),
        filtering: appliedOnly,
        render: (attribute) =>
          added.includes(attribute.name) ? (
            <ActionIcon.Group style={{ justifyContent: "flex-end" }}>
              <Tooltip label="Edit the condition">
                <ActionIcon
                  size="sm"
                  variant="default"
                  aria-label={`Edit the condition on ${attribute.name}`}
                  onClick={() => onEdit(attribute.name)}
                >
                  <PencilIcon size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Remove the condition">
                <ActionIcon
                  size="sm"
                  variant="default"
                  c="red"
                  aria-label={`Remove the condition on ${attribute.name}`}
                  onClick={() => onRemove(attribute.name)}
                >
                  <TrashIcon size={14} />
                </ActionIcon>
              </Tooltip>
            </ActionIcon.Group>
          ) : (
            <Tooltip label="Add a condition">
              <ActionIcon
                size="sm"
                variant="default"
                aria-label={`Add a condition on ${attribute.name}`}
                onClick={() => onAdd(attribute)}
              >
                <PlusIcon size={14} />
              </ActionIcon>
            </Tooltip>
          ),
      },
    ],
    [added, appliedOnly, onAdd, onEdit, onRemove, entityType, names, searched],
  );

  return (
    <DataTable
      idAccessor="name"
      records={records}
      columns={columns}
      withTableBorder
      fetching={isFetching}
      noRecordsText={
        appliedOnly ? "No conditions added yet" : "No attributes found"
      }
      style={{ flex: 1, minHeight: 0 }}
    />
  );
};

export default AttributeTable;
