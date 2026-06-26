import { Table, UnstyledButton } from "@mantine/core";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "./BarList.module.css";

export const BarList: React.FC<{
  data: Record<string, number>;
  labelHeader: string;
  valueHeader?: string;
  maxVisibleItems?: number;
}> = ({
  data,
  labelHeader,
  valueHeader = "Frequency",
  maxVisibleItems = 8,
}) => {
  const [expanded, setExpanded] = useState(false);

  const entries = useMemo(
    () => Object.entries(data).sort((a, b) => b[1] - a[1]),
    [data],
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsedHeight, setCollapsedHeight] = useState<number>();

  useLayoutEffect(() => {
    if (!expanded && scrollRef.current) {
      setCollapsedHeight(scrollRef.current.offsetHeight);
    }
  }, [expanded, typeCount, maxVisibleItems]);

  return (
    <div className={styles.container}>
      <div
        ref={scrollRef}
        className={styles.scrollArea}
        style={expanded ? { maxHeight: collapsedHeight } : undefined}
      >
        <Table variant="vertical" layout="fixed" stickyHeader>
          <Table.Thead className={styles.head}>
            <Table.Tr>
              <Table.Th>
                <span className={styles.headLabel}>
                  {labelHeader}{" "}
                  <span className={styles.headCount}>
                    ({typeCount.toLocaleString()})
                  </span>
                </span>
              </Table.Th>
              <Table.Th>
                <span className={styles.headLabel}>
                  {valueHeader}{" "}
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
          </Table.Tbody>
        </Table>
      </div>
      {hasOverflow && (
        <UnstyledButton
          className={styles.toggleRow}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Show less" : `Show ${typeCount - maxVisibleItems} more`}
        </UnstyledButton>
      )}
    </div>
  );
};
