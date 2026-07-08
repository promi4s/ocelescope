import { ActionIcon, Menu } from "@mantine/core";
import { ControlButton, Controls } from "@xyflow/react";
import { DownloadIcon, Maximize2Icon } from "lucide-react";
import type { VisualizationProps } from "../..";

type GraphControlsProps = {
  onFitView: () => void;
  onDownloadPng: () => void;
  onDownloadSvg: () => void;
  onDownloadPdf: () => void;
  menuItems?: VisualizationProps<"graph">["menuItems"] | undefined;
  isPreview?: boolean | undefined;
};

const GraphControls = ({
  onFitView,
  onDownloadPng,
  onDownloadSvg,
  onDownloadPdf,
  menuItems,
  isPreview,
}: GraphControlsProps) => {
  if (isPreview) return null;

  return (
    <Controls showInteractive={false} showFitView={false}>
      <ControlButton onClick={onFitView} title="fit view">
        <Maximize2Icon size={11} />
      </ControlButton>
      <Menu position="right" withinPortal={false}>
        <Menu.Target>
          <ActionIcon variant="transparent">
            <DownloadIcon color="black" size={18} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={onDownloadPng}>PNG</Menu.Item>
          <Menu.Item onClick={onDownloadSvg}>SVG</Menu.Item>
          <Menu.Item onClick={onDownloadPdf}>PDF</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {menuItems?.map((menuItem) => (
        <ControlButton
          key={menuItem.label}
          onClick={menuItem.onClick}
          title={menuItem.label}
        >
          {menuItem.icon}
        </ControlButton>
      ))}
    </Controls>
  );
};

export default GraphControls;
