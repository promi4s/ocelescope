import { Table, UnstyledButton } from "@mantine/core";
import { useEventCounts, useObjectCounts } from "@ocelescope/api-base";
import { useMemo, useState } from "react";
import styles from "./EntityBarList.module.css";

const countHook = {
  events: useEventCounts,
  objects: useObjectCounts,
};

export const EntityBarList: React.FC<{
  ocelId: string;
  type: keyof typeof countHook;
  maxVisibleItems?: number;
}> = ({ ocelId, type, maxVisibleItems = 8 }) => {
  const { data: counts = {} } = countHook[type](ocelId);
  const [expanded, setExpanded] = useState(false);

  const entries = useMemo(
    () => Object.entries(counts).sort((a, b) => b[1] - a[1]),
    [counts],
  );

  const max = useMemo(
    () => Math.max(0, ...entries.map(([, c]) => c)),
    [entries],
  );

  const typeCount = entries.length;
  const totalFrequency = useMemo(
    () => entries.reduce((sum, [, count]) => sum + count, 0),
    [entries],
  );

  const hasOverflow = typeCount > maxVisibleItems;
  const visibleEntries =
    hasOverflow && !expanded ? entries.slice(0, maxVisibleItems) : entries;

  return (
    <Table variant="vertical" layout="fixed" withTableBorder>
      <Table.Thead className={styles.head}>
        <Table.Tr>
          <Table.Th>
            <span className={styles.headLabel}>
              {type === "events" ? "Activity" : "Object type"}{" "}
              <span className={styles.headCount}>
                ({typeCount.toLocaleString()})
              </span>
            </span>
          </Table.Th>
          <Table.Th>
            <span className={styles.headLabel}>
              Frequency{" "}
              <span className={styles.headCount}>
                ({totalFrequency.toLocaleString()})
              </span>
            </span>
          </Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {visibleEntries.map(([name, count]) => {
          const percentage = max > 0 ? Math.ceil((count / max) * 100) : 0;

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
        {hasOverflow && (
          <Table.Tr>
            <Table.Td colSpan={2} p={0}>
              <UnstyledButton
                className={styles.toggleRow}
                onClick={() => setExpanded((prev) => !prev)}
              >
                {expanded
                  ? "Show less"
                  : `Show ${typeCount - maxVisibleItems} more`}
              </UnstyledButton>
            </Table.Td>
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
  );
};
