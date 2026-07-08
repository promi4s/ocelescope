import { ActionIcon, Badge, Group, Popover, ScrollArea } from "@mantine/core";
import { XIcon } from "lucide-react";
import { type MouseEvent, useCallback, useState } from "react";
import type { VisualizationsType } from "../../../../../types";
import { Visualization } from "../../../index";

export const AnnotationBadge = () => (
  <Badge
    size="xs"
    variant="filled"
    color="gray"
    title="This graph element has an annotation visualization."
  >
    i
  </Badge>
);

export const NodeAnnotation = ({
  annotation,
}: {
  annotation: VisualizationsType;
}) => {
  const [opened, setOpened] = useState(false);

  const toggle = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setOpened((o) => !o);
  }, []);

  return (
    <Popover
      opened={opened}
      onClose={() => setOpened(false)}
      position="right"
      withArrow
      withinPortal
      shadow="md"
    >
      <Popover.Target>
        <button
          type="button"
          className="nodrag nopan"
          style={{
            position: "absolute",
            right: -8,
            top: -8,
            cursor: "pointer",
            pointerEvents: "all",
            zIndex: 10,
            background: "none",
            border: "none",
            padding: 0,
          }}
          onClick={toggle}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <AnnotationBadge />
        </button>
      </Popover.Target>
      <Popover.Dropdown style={{ minWidth: 200, maxWidth: 400 }}>
        <Group justify="flex-end" mb={4}>
          <ActionIcon
            size="xs"
            variant="subtle"
            color="gray"
            onClick={() => setOpened(false)}
          >
            <XIcon size={12} />
          </ActionIcon>
        </Group>
        <ScrollArea.Autosize mah={300}>
          <Visualization visualization={annotation} />
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
};
