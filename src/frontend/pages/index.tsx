import OcelTable from "@/components/OcelTable/OcelTable";
import OutputTable from "@/components/Outputs/OutputTable";
import { Container, Stack } from "@mantine/core";

const Overview = () => {
  return (
    <Container>
      <Stack gap={"xl"}>
        <OcelTable />
        <OutputTable />
      </Stack>
    </Container>
  );
};

export default Overview;
