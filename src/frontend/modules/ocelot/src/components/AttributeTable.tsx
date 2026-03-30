import { useAggregatedAttributes } from "@ocelescope/api-base";
import { DataTable } from "mantine-datatable";
import { formatAttributeValue } from "../util/attributes";

const AttributeTable: React.FC<{
  ocelId: string;
}> = ({ ocelId }) => {
  const { data: attributes = [] } = useAggregatedAttributes(ocelId);

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
    />
  );
};

export default AttributeTable;
