import { Container, Grid, LoadingOverlay, Stack, Title } from "@mantine/core";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import AttributeTable from "../components/AttributeTable";
import { EntityBarList } from "../components/EntityBarList/EntityBarList";
import OCELInfo from "../components/OcelInfo";

const LogOverviewPage = () => {
  const { id } = useCurrentOcel();
  if (!id) {
    return <LoadingOverlay />;
  }
  return (
    <Container fluid>
      <Grid>
        <Grid.Col span={12}>
          <Stack>
            <Title order={2}>Overview</Title>
            <OCELInfo ocelId={id} />
          </Stack>
        </Grid.Col>
        <Grid.Col span={12}>
          <Stack>
            <Title order={2}>Attribute Info</Title>
            <AttributeTable ocelId={id} />
          </Stack>
        </Grid.Col>
        <Grid.Col span={6}>
          <Stack>
            <Title order={2}>Actitvities</Title>
            <EntityBarList type="events" ocelId={id} />
          </Stack>
        </Grid.Col>
        <Grid.Col span={6}>
          <Stack>
            <Title order={2}>Objects</Title>
            <EntityBarList type="objects" ocelId={id} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Container>
  );
};

export default defineModuleRoute({
  component: LogOverviewPage,
  label: "Log Overview",
  name: "logOverview",
  requiresOcel: true,
});
