import type { ReactNode } from "react";
import { HiddenHandles } from "./HiddenHandles";
import { NodeLabel } from "./NodeLabel";

type TerminalNodeProps = {
  label?: string | null | undefined;
  children: ReactNode;
};

export const TerminalNode = ({ children, label }: TerminalNodeProps) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
    }}
  >
    <HiddenHandles />
    {children}
    {label && <NodeLabel>{label}</NodeLabel>}
  </div>
);
