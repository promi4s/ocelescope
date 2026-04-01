import {
  useAggregatedAttributes,
  useEventAttributes,
  useObjectAttributes,
  type AggregatedAttribute,
  type TypedAttribute,
} from "@ocelescope/api-base";
import { DataTable } from "mantine-datatable";
import { formatAttributeValue } from "../util/attributes";
import { useMemo } from "react";
import {
  BoxIcon,
  Calendar1Icon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useSelection } from "@mantine/hooks";
import { Group, ThemeIcon, Tooltip } from "@mantine/core";

type Attribtue = Pick<
  TypedAttribute,
  Extract<keyof TypedAttribute, keyof AggregatedAttribute>
> & {
  entityType: "aggr" | "event" | "object";
  entityTypeField: string;
  collapsible?: boolean;
};

const entityMap = {
  event: Calendar1Icon,
  object: BoxIcon,
};

const AttributesTable: React.FC<{
  ocelId: string;
}> = ({ ocelId }) => {
  const { data: attributes = [] } = useAggregatedAttributes(ocelId);

  const { data: objectAttributes = [] } = useObjectAttributes(ocelId);
  const { data: eventAttributes = [] } = useEventAttributes(ocelId);

  const [selection, handlers] = useSelection({
    data: attributes.map(({ name }) => name),
  });

  const records = useMemo(
    () =>
      [
        ...attributes.map<Attribtue>((attribute) => {
          const collapsible =
            attribute.object_types.length + attribute.actitvities.length > 1;

          return {
            ...attribute,
            entityType: collapsible
              ? "aggr"
              : attribute.object_types.length > 0
                ? "object"
                : "event",
            collapsible,
            entityTypeField: !collapsible
              ? ([...attribute.object_types, ...attribute.actitvities][0] ?? "")
              : [
                  ...(attribute.actitvities.length > 0
                    ? [`${attribute.actitvities.length} Activities`]
                    : []),
                  ...(attribute.object_types.length > 0
                    ? [`${attribute.object_types.length} Object Types`]
                    : []),
                ].join(", "),
          };
        }),
        ...objectAttributes
          .map<Attribtue>((attribute) => ({
            ...attribute,
            entityType: "object",
            entityTypeField: attribute.entity_type,
          }))
          .filter(({ name }) => selection.includes(name)),
        ...eventAttributes
          .map<Attribtue>((attribute) => ({
            ...attribute,
            entityType: "event",
            entityTypeField: attribute.entity_type,
          }))
          .filter(({ name }) => selection.includes(name)),
      ].sort((a, b) => {
        const byName = a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        });
        if (byName !== 0) return byName;

        return a.entityTypeField.localeCompare(b.entityTypeField, undefined, {
          sensitivity: "base",
        });
      }),
    [attributes, objectAttributes, eventAttributes, selection],
  );

  return (
    <DataTable
      columns={[
        {
          accessor: "selector",
          title: "",
          render: ({ collapsible, name }) => {
            return (
              <>
                {collapsible && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <ThemeIcon size={"xs"} variant="subtle">
                      {selection.includes(name) ? (
                        <ChevronDown />
                      ) : (
                        <ChevronRight />
                      )}
                    </ThemeIcon>
                  </div>
                )}
              </>
            );
          },
        },
        {
          accessor: "name",
          title: "Attribute Name",
        },
        { accessor: "type", title: "Attribute Type" },
        {
          accessor: "entityTypeField",
          title: "Type",
          render: ({ entityTypeField, entityType }) => {
            if (entityType === "aggr") {
              return entityTypeField;
            }

            const Icon = entityMap[entityType];

            return (
              <Group>
                <Tooltip label={entityType}>
                  <ThemeIcon size={"xs"} variant="subtle">
                    <Icon />
                  </ThemeIcon>
                </Tooltip>
                {entityTypeField}
              </Group>
            );
          },
        },
        {
          accessor: "range",
          render: ({ type, min, max }) =>
            `${formatAttributeValue(type, min)} - ${formatAttributeValue(type, max)}`,
        },
        { accessor: "distinct_values", title: "Values" },
      ]}
      records={records}
      onRowClick={({ record }) => {
        if (record.collapsible) handlers.toggle(record.name);
      }}
      highlightOnHover
    />
  );
};

export default AttributesTable;
