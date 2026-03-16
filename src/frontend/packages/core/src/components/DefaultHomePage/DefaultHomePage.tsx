import { Container, Stack } from "@mantine/core";
import EntityTable from "../EntityTable/EntityTable";

const DefaultHomePage: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  return (
    <Container h="100%">
      <Stack gap={"sm"} h="100%">
        <EntityTable />
        {children}
      </Stack>
    </Container>
  );
};

export default DefaultHomePage;
