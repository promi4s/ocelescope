import { Table } from "@mantine/core";
import { useEventCounts, useObjectCounts } from "@ocelescope/api-base";
import { useMemo } from "react";
import styles from "./OCELEntityBarList.module.css";

const countHook = {
  events: useEventCounts,
  objects: useObjectCounts,
};

export const OCELEntityBarList: React.FC<{
  ocelId: string;
  type: keyof typeof countHook;
}> = ({ ocelId, type }) => {
  const { data: counts = {} } = countHook[type](ocelId);

  const max = useMemo(() => Math.max(...Object.values(counts)), [counts]);

  return (
    <Table variant="vertical" layout="fixed" withTableBorder>
      <Table.Tbody>
        {Object.entries(counts).map(([name, count]) => (
          <Table.Tr key={name}>
            <Table.Th>{name}</Table.Th>
            <Table.Td>
              <div className={styles.barCell}>
                <div
                  className={styles.bar}
                  style={{ width: `${Math.ceil((count / max) * 100)}%` }}
                >
                  <div className={styles.outerWrapper}>
                    <div className={styles.innerWrapper}>
                      <span className={styles.labelInside}>{count}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
};
