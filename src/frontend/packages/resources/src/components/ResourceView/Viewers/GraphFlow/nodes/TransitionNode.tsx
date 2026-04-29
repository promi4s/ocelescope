import { Text } from "@mantine/core";
import { type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import { HiddenHandles } from "../components/HiddenHandles";
import { DEFAULT_COLORS, TRANSITION_HEIGHT } from "../constants/graphFlow";

export type TransitionNodeData = {
  label?: string | null;
  color: string;
  borderColor?: string | null;
};

export type TransitionNodeType = Node<TransitionNodeData, "transition">;

const SilentTransition = () => (
  <div
    style={{
      width: 10,
      height: TRANSITION_HEIGHT,
      backgroundColor: "#222",
      borderRadius: 2,
      boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
    }}
  />
);

const LabeledTransition = ({
  label,
  borderColor,
}: {
  label: string;
  borderColor?: string | null | undefined;
}) => (
  <div
    style={{
      boxSizing: "border-box",
      minWidth: 90,
      maxWidth: 200,
      width: "max-content",
      height: TRANSITION_HEIGHT,
      padding: "0 12px",
      backgroundColor: DEFAULT_COLORS.transition,
      border: `1.5px solid ${borderColor ?? DEFAULT_COLORS.transitionBorder}`,
      borderRadius: 5,
      boxShadow: "0 2px 6px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.06)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Text
      size="sm"
      fw={500}
      ta="center"
      style={{
        lineHeight: 1.2,
        color: "#111",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: 176,
      }}
    >
      {label}
    </Text>
  </div>
);

const TransitionNode = memo(({ data }: NodeProps<TransitionNodeType>) => (
  <>
    <HiddenHandles />
    {data.label ? (
      <LabeledTransition label={data.label} borderColor={data.borderColor} />
    ) : (
      <SilentTransition />
    )}
  </>
));

TransitionNode.displayName = "TransitionNode";

export default TransitionNode;
