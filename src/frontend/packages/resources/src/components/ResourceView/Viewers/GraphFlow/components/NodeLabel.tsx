import { Text } from "@mantine/core";
import { DEFAULT_COLORS } from "../constants/graphFlow";

type NodeLabelProps = {
  children: string;
  absolute?: boolean;
  top?: number;
};

export const NodeLabel = ({ children, absolute = false, top }: NodeLabelProps) => (
  <Text
    size="xs"
    fw={600}
    style={{
      ...(absolute
        ? {
            position: "absolute",
            top,
            left: "50%",
            transform: "translateX(-50%)",
          }
        : null),
      whiteSpace: "nowrap",
      color: DEFAULT_COLORS.text,
      pointerEvents: "none",
      letterSpacing: "0.01em",
    }}
  >
    {children}
  </Text>
);
