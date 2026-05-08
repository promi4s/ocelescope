import { ActionIcon, Box, Tooltip } from "@mantine/core";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";

type DiscoverySettingsPanelProps = {
  width: number;
  collapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
  onResizeStart: (event: ReactMouseEvent) => void;
  children: ReactNode;
};

export const DiscoverySettingsPanel = ({
  width,
  collapsed,
  onCollapseChange,
  onResizeStart,
  children,
}: DiscoverySettingsPanelProps) => (
  <Box
    style={{
      borderLeft: "1px solid var(--mantine-color-default-border)",
      display: "flex",
      flexDirection: "row",
      flexShrink: 0,
      width: collapsed ? 36 : undefined,
    }}
  >
    {collapsed ? (
      <Tooltip label="Expand settings" position="left" withArrow>
        <Box
          style={{
            width: 36,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: 10,
            cursor: "pointer",
          }}
          onClick={() => onCollapseChange(false)}
        >
          <ActionIcon variant="subtle" color="gray" size="sm">
            <ChevronsLeft size={15} />
          </ActionIcon>
        </Box>
      </Tooltip>
    ) : (
      <>
        <Box
          style={{
            width: 12,
            flexShrink: 0,
            position: "relative",
            cursor: "col-resize",
          }}
          onMouseDown={onResizeStart}
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor =
              "var(--mantine-color-default-hover)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor = "";
          }}
        >
          <Tooltip label="Collapse settings" position="left" withArrow>
            <ActionIcon
              size="sm"
              variant="default"
              radius="xl"
              style={{
                position: "absolute",
                top: 10,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1,
              }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={() => onCollapseChange(true)}
            >
              <ChevronsRight size={12} />
            </ActionIcon>
          </Tooltip>
        </Box>

        <Box
          style={{
            width,
            flexShrink: 0,
            overflowY: "auto",
          }}
          p="lg"
        >
          {children}
        </Box>
      </>
    )}
  </Box>
);
