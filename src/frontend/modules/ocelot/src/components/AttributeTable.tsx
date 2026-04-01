import {
  useAggregatedAttributes,
  useEventAttributes,
  useObjectAttributes,
  type AggregatedAttribute,
  type TypedAttribute,
} from "@ocelescope/api-base";
import { DataTable } from "mantine-datatable";
import { formatAttributeValue } from "../util/attributes";
import { useMemo, useState } from "react";
import {
  BoxIcon,
  Calendar1Icon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { Group, Radio, ThemeIcon, Tooltip } from "@mantine/core";

const entityMap = {
  activity: Calendar1Icon,
  object: BoxIcon,
};

type Attribute =
  | (AggregatedAttribute & { discriminator: "aggr" })
  | (TypedAttribute & { discriminator: "activity" | "object" });

export const isAggregatedAttribute = (
  attribute: Attribute,
): attribute is AggregatedAttribute & { discriminator: "aggr" } => {
  return attribute.discriminator === "aggr";
};

const AttributesTable: React.FC<{
  ocelId: string;
}> = ({ ocelId }) => {
  const { data: attributes, isLoading: isAttributesLoading } =
    useAggregatedAttributes(ocelId);

  const { data: objectAttributes, isLoading: isObjectAttributesLoading } =
    useObjectAttributes(ocelId);
  const { data: eventAttributes, isLoading: isActivityAttributesLoading } =
    useEventAttributes(ocelId);

  const [selection, setSelection] = useState<string[]>([]);

  const [selectedEntityType, setSelectedEntityType] =
    useState<Attribute["discriminator"]>("aggr");

  const { records } = useMemo(() => {
    if (!attributes || !objectAttributes || !eventAttributes) {
      return { records: [] };
    }

    const filteredAggregatedAttributes = attributes
      .map<Extract<Attribute, { discriminator: "aggr" }>>((attribute) => ({
        ...attribute,
        discriminator: "aggr",
        object_types:
          selectedEntityType === "activity" ? [] : attribute.object_types,
        actitvities:
          selectedEntityType === "object" ? [] : attribute.actitvities,
      }))
      .filter(({ actitvities, object_types }) => {
        const count =
          (selectedEntityType === "object" ? 0 : actitvities.length) +
          (selectedEntityType === "activity" ? 0 : object_types.length);

        return count > 1;
      });

    const uniqueAttributes = attributes
      .filter(
        ({ name }) =>
          !filteredAggregatedAttributes.some(
            ({ name: filteredName }) => name === filteredName,
          ),
      )
      .map(({ name }) => name);

    const filteredObjectAttributes = (
      selectedEntityType !== "activity" ? objectAttributes : []
    )
      .map<Attribute>((attribute) => ({
        ...attribute,
        discriminator: "object",
      }))
      .filter(
        ({ name }) =>
          uniqueAttributes.includes(name) || selection.includes(name),
      );

    const filteredActivityAttributes = (
      selectedEntityType !== "object" ? eventAttributes : []
    )
      .map<Attribute>((attribute) => ({
        ...attribute,
        discriminator: "activity",
      }))
      .filter(
        ({ name }) =>
          uniqueAttributes.includes(name) || selection.includes(name),
      );

    const records = [
      ...filteredAggregatedAttributes,
      ...filteredObjectAttributes,
      ...filteredActivityAttributes,
    ].sort((attribute1, attribute2) => {
      const byAttributeName = attribute1.name.localeCompare(attribute2.name);

      if (byAttributeName !== 0) return byAttributeName;

      if (
        isAggregatedAttribute(attribute1) ||
        isAggregatedAttribute(attribute2)
      )
        return isAggregatedAttribute(attribute1) ? -1 : 1;

      const byEntityType = attribute1.entity_type.localeCompare(
        attribute2.entity_type,
      );

      if (byEntityType !== 0) return byEntityType;

      return 0;
    });

    return { records };
  }, [
    attributes,
    objectAttributes,
    eventAttributes,
    selection,
    selectedEntityType,
  ]);

  return (
    <DataTable
      minHeight={150}
      columns={[
        {
          accessor: "selector",
          title: "",
          render: (attribute) => {
            const collapsible = isAggregatedAttribute(attribute)
              ? attribute.object_types.length + attribute.actitvities.length > 1
              : false;
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
                      {selection.includes(attribute.name) ? (
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
          render: (attribute) => {
            if (isAggregatedAttribute(attribute)) {
              return [
                ...(attribute.actitvities.length > 0
                  ? [`${attribute.actitvities.length} Activities`]
                  : []),
                ...(attribute.object_types.length > 0
                  ? [`${attribute.object_types.length} Object Types`]
                  : []),
              ].join(", ");
            }

            const Icon = entityMap[attribute.discriminator];

            return (
              <Group>
                <Tooltip label={attribute.discriminator}>
                  <ThemeIcon size={"xs"} variant="subtle">
                    <Icon />
                  </ThemeIcon>
                </Tooltip>
                {attribute.entity_type}
              </Group>
            );
          },
          filter: () => (
            <Radio.Group
              value={selectedEntityType}
              label="Visible Types"
              onChange={(newValue) =>
                setSelectedEntityType(newValue as Attribute["discriminator"])
              }
            >
              <Group mt="xs">
                <Radio value={"aggr"} label="All" />
                <Radio value={"activity"} label="Events" />
                <Radio value={"object"} label="Objects" />
              </Group>
            </Radio.Group>
          ),
          filtering: selectedEntityType !== "aggr",
        },
        {
          accessor: "range",
          render: ({ type, min, max }) =>
            `${formatAttributeValue(type, min)} - ${formatAttributeValue(type, max)}`,
        },
        { accessor: "distinct_values", title: "Values" },
      ]}
      records={records}
      highlightOnHover
      onRowClick={({ record }) => {
        if (isAggregatedAttribute(record)) {
          setSelection((prev) =>
            prev.includes(record.name)
              ? prev.filter((attrName) => attrName !== record.name)
              : [...prev, record.name],
          );
        }
      }}
      fetching={
        isActivityAttributesLoading ||
        isObjectAttributesLoading ||
        isAttributesLoading
      }
    />
  );
};

export default AttributesTable;
