import {
  ObjectAttributes200Item,
  RelationCountSummary,
} from "@/api/fastapi-schemas";
import { Divider, Flex, Table, Text } from "@mantine/core";

type EntityCardProps = {
  name: string;
  count: number;
  attributeSummaries?: ObjectAttributes200Item[];
  relationSummaries?: RelationCountSummary[];
};

const EntityCard: React.FC<EntityCardProps> = ({
  name,
  count,
  attributeSummaries = [],
  relationSummaries = [],
}) => {
  return (
    <Flex
      w="100%"
      bd={"1px solid black"}
      bg={"white"}
      miw={200}
      mih={100}
      direction={"column"}
    >
      <Text fw={700} size="sm" ta="center" py={"4"}>
        {`${name} (${count})`}
      </Text>
      <Divider c={"black"} size={"md"} />
      {attributeSummaries.length !== 0 && (
        <Table
          withRowBorders={false}
          captionSide="top"
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <Table.Caption mb={0}>Attributes</Table.Caption>
          <Table.Tbody>
            {attributeSummaries.map((attribute) => (
              <Table.Tr>
                <Table.Td> {attribute.attribute}</Table.Td>
                <Table.Td ta={"end"}>{attribute.type}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {relationSummaries.length !== 0 && (
        <>
          <Table
            withRowBorders={false}
            captionSide="top"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <Table.Caption mb={0}>Relations</Table.Caption>
            <Table.Tbody>
              {relationSummaries.map(
                ({ target, qualifier, min_count, max_count }) => (
                  <Table.Tr>
                    <Table.Td>{target}</Table.Td>
                    <Table.Td>{qualifier ?? "None"}</Table.Td>
                    <Table.Td>
                      {min_count < max_count
                        ? `${min_count}-${max_count}`
                        : min_count}
                    </Table.Td>
                  </Table.Tr>
                ),
              )}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Flex>
  );
};

export default EntityCard;
