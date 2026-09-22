import { ActionIcon, Splitter, Tooltip } from "@mantine/core";
import { type UseSplitterReturnValue } from "@mantine/hooks";
import { ResultSection } from "@ocelescope/plugin-components";
import { Settings } from "lucide-react";
import { useEffect, useRef, type PropsWithChildren } from "react";

type PluginDashboardProps = {
  pluginTaskId?: string;
  withHandle?: boolean;
  collapseOnNoTask?: boolean;
};

export const PluginDashboard = ({
  pluginTaskId,
  withHandle = true,
  collapseOnNoTask = true,
  children,
}: PropsWithChildren<PluginDashboardProps>) => {
  const splitterRef = useRef<UseSplitterReturnValue>(null);

  const isCollapsed = !pluginTaskId && collapseOnNoTask;

  useEffect(() => {
    if (pluginTaskId && splitterRef.current?.sizes[0] === 0) {
      splitterRef.current.setSizes([70, 30]);
    }
  }, [pluginTaskId]);

  return (
    <Splitter
      splitterRef={splitterRef}
      withHandle={!isCollapsed && withHandle}
      h={"100%"}
      handleColor="var(--mantine-color-default-border)"
      lineSize={2}
    >
      <Splitter.Pane defaultSize={isCollapsed ? 0 : 70}>
        <ResultSection
          taskId={pluginTaskId}
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
