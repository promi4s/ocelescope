import { Button, ButtonGroup } from "@mantine/core";
import { DownloadIcon, Maximize, Save, Settings } from "lucide-react";
import { useCytoscapeContext } from "../CytoscapeContext";

const ActionButtons: React.FC<{
  toggleOptions?: () => void;
  onSave?: () => void;
}> = ({ toggleOptions, onSave }) => {
  const context = useCytoscapeContext();

  const downloadGraphAsPng = () => {
    const cytoscape = context?.cy.current; // or however you reference your cy instance
    if (!cytoscape) return;

    const pngData = cytoscape.png({
      full: true,
      scale: 2,
      bg: "#ffffff",
    });

    const a = document.createElement("a");
    a.href = pngData;
    a.download = "graph.png";
    a.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
  };

  return (
    <ButtonGroup
      style={{ zIndex: 2 }}
      orientation="vertical"
      pos={"absolute"}
      bottom={0}
      left={0}
    >
      <>
        <Button
          disabled={!context}
          px={"xs"}
          variant="default"
          onClick={
            context &&
            (() => {
              console.log(context.cy.current);
              if (context.cy.current) context.cy.current.fit();
            })
          }
        >
          <Maximize size={18} />
        </Button>
        <Button
          disabled={!context}
          onClick={downloadGraphAsPng}
          px={"xs"}
          variant="default"
        >
          <DownloadIcon size={18} />
        </Button>
      </>
      {toggleOptions && (
        <Button onClick={toggleOptions} px={"xs"} variant="default">
          <Settings size={18} />
        </Button>
      )}
      {onSave && (
        <Button onClick={onSave} px={"xs"} variant="default">
          <Save size={18} />
        </Button>
      )}
    </ButtonGroup>
  );
};

export default ActionButtons;
