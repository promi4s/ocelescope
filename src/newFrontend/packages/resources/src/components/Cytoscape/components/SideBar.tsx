import { Box, Button, Paper } from "@mantine/core";
import { X } from "lucide-react";

const CytoscapeSidebar: React.FC<{
  children?: React.ReactNode;
  close: () => void;
}> = ({ close, children }) => {
  return (
    <Paper
      style={{ zIndex: 2 }}
      shadow="xs"
      p="xl"
      pos={"absolute"}
      top={0}
      right={0}
      w={"30%"}
      h={"100%"}
    >
      <Button
        onClick={close}
        p={2}
        pos={"absolute"}
        top={2}
        right={2}
        variant="subtle"
      >
        <X />
      </Button>
      <Box>{children}</Box>
    </Paper>
  );
};

export default CytoscapeSidebar;
