import { ActionIcon, Splitter, Tooltip } from "@mantine/core";
import type { UseSplitterReturnValue } from "@mantine/hooks";
import { Settings } from "lucide-react";
import { type PropsWithChildren, useEffect, useRef } from "react";
import OutputSection, {
  type OutputSectionProps,
} from "./Outputs/OutputSection";

type PluginDashboardProps = {
  taskId?: string;
  withHandle?: boolean;
  collapseOnNoTask?: boolean;
  autoShowFirstOutput?: OutputSectionProps["autoShowFirstOutput"];
};

export const PluginDashboard = ({
  taskId,
  withHandle = true,
  collapseOnNoTask = true,
  autoShowFirstOutput,
  children,
}: PropsWithChildren<PluginDashboardProps>) => {
  const splitterRef = useRef<UseSplitterReturnValue>(null);

  const isCollapsed = !taskId && collapseOnNoTask;

  useEffect(() => {
    if (taskId && splitterRef.current?.sizes[0] === 0) {
      splitterRef.current.setSizes([70, 30]);
    }
  }, [taskId]);

  return (
    <Splitter
      splitterRef={splitterRef}
      withHandle={!isCollapsed && withHandle}
      h={"100%"}
      handleColor="var(--mantine-color-default-border)"
      lineSize={2}
    >
      <Splitter.Pane defaultSize={isCollapsed ? 0 : 70}>
        <OutputSection
          taskId={taskId}
          autoShowFirstOutput={autoShowFirstOutput}
          extraActions={
            <Tooltip label="Toggle settings">
              <ActionIcon
                size="input-sm"
                variant="outline"
                onClick={() => splitterRef.current?.toggleCollapse(1)}
              >
                <Settings size={20} />
              </ActionIcon>
            </Tooltip>
          }
        />
      </Splitter.Pane>
      <Splitter.Pane
        defaultSize={isCollapsed ? 100 : 30}
        max={"500px"}
        min={"300px"}
        collapsible
      >
        {children}
      </Splitter.Pane>
    </Splitter>
  );
};
