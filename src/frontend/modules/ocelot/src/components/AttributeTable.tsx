import {
  useAggregatedAttributes,
  useEventAttributes,
  useObjectAttributes,
} from "@ocelescope/api-base";
import { DataTable } from "mantine-datatable";
import { formatAttributeValue } from "../util/attributes";
import { useState } from "react";

const AttributeTable: React.FC<{
  ocelId: string;
  attribute: string;
}> = ({ ocelId, attribute }) => {
  const { data: objectAttributes = [], isLoading: isObjectLoading } =
    useObjectAttributes(ocelId, { attribute_names: [attribute] });
  const { data: eventAttributes = [], isLoading: isEventLoading } =
    useEventAttributes(ocelId, { attribute_names: [attribute] });

  return (
    <DataTable
      noHeader
      withColumnBorders
      columns={[
        { accessor: "entity_type", title: "Attribute Name" },
        { accessor: "type", title: "Type" },
        {
          accessor: "range",
          render: ({ type, min, max }) =>
            `${formatAttributeValue(type, min)} - ${formatAttributeValue(type, max)}`,
        },
        { accessor: "distinct_values", title: "Values" },
      ]}
      records={[...objectAttributes, ...eventAttributes]}
      fetching={isObjectLoading || isEventLoading}
    />
  );
};

const AttributesTable: React.FC<{
  ocelId: string;
}> = ({ ocelId }) => {
  const { data: attributes = [] } = useAggregatedAttributes(ocelId);
  const [expandedRecordIds, setExpandedRecordIds] = useState<string[]>([]);

  return (
    <DataTable
      columns={[
        { accessor: "name", title: "Attribute Name" },
        { accessor: "type", title: "Type" },
        {
          accessor: "entities",
          title: "Entities",
          render: ({ actitvities, object_types }) =>
            [
              ...(actitvities.length > 0
                ? [`${actitvities.length} Activities`]
                : []),
              ...(object_types.length > 0
                ? [`${object_types.length} Object Types`]
                : []),
            ].join(", "),
        },
        {
          accessor: "range",
          render: ({ type, min, max }) =>
            `${formatAttributeValue(type, min)} - ${formatAttributeValue(type, max)}`,
        },
        { accessor: "distinct_values", title: "Values" },
      ]}
      records={attributes}
      rowExpansion={{
        allowMultiple: true,
        expanded: {
          recordIds: expandedRecordIds,
          onRecordIdsChange: setExpandedRecordIds,
        },
        content: ({ record }) => (
          <AttributeTable ocelId={ocelId} attribute={record.name} />
        ),
      }}
      idAccessor={"name"}
    />
  );
};

export default AttributesTable;
