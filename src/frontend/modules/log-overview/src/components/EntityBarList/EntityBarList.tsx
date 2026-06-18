import { Table, Text } from "@mantine/core";
import { useEventCounts, useObjectCounts } from "@ocelescope/api-base";
import { useMemo } from "react";
import styles from "./EntityBarList.module.css";

const countHook = {
  events: useEventCounts,
  objects: useObjectCounts,
};

export const EntityBarList: React.FC<{
  ocelId: string;
  type: keyof typeof countHook;
}> = ({ ocelId, type }) => {
  const { data: counts = {} } = countHook[type](ocelId);

  const max = useMemo(() => Math.max(...Object.values(counts)), [counts]);

  return (
    <Table variant="vertical" layout="fixed" withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>
            <Text size={"md"} fw={500}>
              {type === "events" ? "Actitivty" : "Object type"}
            </Text>
          </Table.Th>
          <Table.Th>
            <Text size={"md"} fw={500}>
              Frequency
            </Text>
          </Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {Object.entries(counts).map(([name, count]) => {
          const percentage = Math.ceil((count / max) * 100);

          return (
            <Table.Tr key={name}>
              <Table.Td>{name}</Table.Td>
              <Table.Td>
                <div className={styles.barCell}>
                  <div
                    className={styles.bar}
                    style={{ width: `${percentage}%` }}
                  >
                    {percentage > 50 && (
                      <span className={styles.labelInside}>{count}</span>
                    )}
                  </div>
                  {percentage <= 50 && (
                    <span className={styles.labelOutside}>{count}</span>
                  )}
                </div>
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
};
