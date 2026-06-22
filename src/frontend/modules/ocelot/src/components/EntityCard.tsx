import { Divider, Flex, Table, Text } from "@mantine/core";
import type {
  RelationCountSummary,
  TypedAttribute,
} from "@ocelescope/api-base";

type EntityCardProps = {
  name: string;
  count: number;
  attributeSummaries?: TypedAttribute[];
  relationSummaries?: RelationCountSummary[];
  maw?: number;
};

const EntityCard: React.FC<EntityCardProps> = ({
  name,
  count,
  attributeSummaries = [],
  relationSummaries = [],
  maw,
}) => {
  return (
    <Flex
      w="100%"
      bd={"1px solid black"}
      bg={"white"}
      miw={200}
      maw={maw}
      mih={100}
      direction={"column"}
    >
      <Text
        fw={700}
        size="sm"
        ta="center"
        py={"4"}
        px={"xs"}
        style={{ wordBreak: "break-word" }}
      >
        {`${name} (${count})`}
      </Text>
      <Divider c={"black"} size={"md"} />
      {attributeSummaries.length !== 0 && (
        <Table withRowBorders={false} captionSide="top" layout="fixed">
          <Table.Caption mb={0}>Attributes</Table.Caption>
          <Table.Tbody>
            {attributeSummaries.map((attribute) => (
              <Table.Tr key={attribute.name}>
                <Table.Td style={{ wordBreak: "break-word" }}>
                  {attribute.name}
                </Table.Td>
                <Table.Td ta={"end"} style={{ wordBreak: "break-word" }}>
                  {attribute.type}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {relationSummaries.length !== 0 && (
        <Table withRowBorders={false} captionSide="top" layout="fixed">
          <Table.Caption mb={0}>Relations</Table.Caption>
          <Table.Tbody>
            {relationSummaries.map(
              ({ target, qualifier, min_count, max_count }) => (
                <Table.Tr key={`${target}-${qualifier}`}>
                  <Table.Td style={{ wordBreak: "break-word" }}>
                    {target}
                  </Table.Td>
                  <Table.Td style={{ wordBreak: "break-word" }}>
                    {qualifier ?? "None"}
                  </Table.Td>
                  <Table.Td ta={"end"} w={70} style={{ whiteSpace: "nowrap" }}>
                    {min_count < max_count
                      ? `${min_count}-${max_count}`
                      : min_count}
                  </Table.Td>
                </Table.Tr>
              ),
            )}
          </Table.Tbody>
        </Table>
      )}
    </Flex>
  );
};

export default EntityCard;
