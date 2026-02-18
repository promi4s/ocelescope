import { Box, Button, ButtonGroup } from "@mantine/core";
import { saveAs } from "file-saver";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { DownloadIcon, MaximizeIcon, MinusIcon, PlusIcon } from "lucide-react";
import { Fragment } from "react";
import type { VisualizationProps } from "../../../types";

export const SvgPanWrapper: React.FC<{
  onDownload: () => void;
  children: React.ReactNode;
}> = ({ children, onDownload }) => {
  return (
    <Box
      w="100%"
      h="100%" // if parent has no height, use h="100dvh"
      pos="relative"
    >
      <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={10}
        centerOnInit
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <TransformComponent
              wrapperStyle={{
                width: "100%",
                height: "100%",
              }}
              contentStyle={{
                width: "100%",
                height: "100%",
              }}
            >
              {children}
            </TransformComponent>
            <ButtonGroup orientation="vertical" pos={"absolute"} bottom={0}>
              <Button px="xs">
                <MaximizeIcon width={18} onClick={() => resetTransform(0)} />
              </Button>
              <Button px="xs">
                <PlusIcon width={18} onClick={() => zoomIn()} />
              </Button>
              <Button px="xs">
                <MinusIcon width={18} onClick={() => zoomOut()} />
              </Button>
              <Button px="xs" onClick={onDownload}>
                <DownloadIcon width={18} />
              </Button>
            </ButtonGroup>
          </>
        )}
      </TransformWrapper>
    </Box>
  );
};

const SvgViewer: React.FC<VisualizationProps<"svg">> = ({
  visualization,
  isPreview,
}) => {
  // Make SVG responsive
  const cleanedSvg = visualization.svg
    .replace(/width="[^"]+"/, 'width="100%"')
    .replace(/height="[^"]+"/, 'height="100%"')
    .replace(/<svg(?![^>]*xmlns=)/, '<svg xmlns="http://www.w3.org/2000/svg"');

  const Wrapper = isPreview ? Fragment : SvgPanWrapper;

  const handleDownload = () => {
    if (!cleanedSvg) return;
    const blob = new Blob([cleanedSvg], {
      type: "image/svg+xml;charset=utf-8",
    });
    saveAs(blob, "resource.svg");
  };

  return (
    <Wrapper onDownload={handleDownload}>
      <div
        style={{ width: "100%", height: "100%" }}
        dangerouslySetInnerHTML={{ __html: cleanedSvg }}
      />
    </Wrapper>
  );
};

export default SvgViewer;
