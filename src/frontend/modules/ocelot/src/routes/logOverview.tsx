import { Container, Grid, LoadingOverlay, Stack, Title } from "@mantine/core";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import OCELInfo from "../components/OcelInfo";
import AttributeTable from "../components/AttributeTable";
import { EntityBarList } from "../components/EntityBarList/EntityBarList";
import AnnotationSection from "../components/AnnotationSection/AnnotationSection";

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

        <Grid.Col span={6}>
          <Stack>
            <Title order={2}>Categories</Title>
            <AnnotationSection ocelId={id} kind="categories" />
          </Stack>
        </Grid.Col>
        <Grid.Col span={6}>
          <Stack>
            <Title order={2}>Labels</Title>
            <AnnotationSection ocelId={id} kind="labels" />
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
