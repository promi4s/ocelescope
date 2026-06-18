import {
  Container,
  Grid,
  LoadingOverlay,
  Stack,
  Tabs,
  Title,
} from "@mantine/core";
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
            <Title order={2}>Overviewer</Title>
            <OCELInfo ocelId={id} />
          </Stack>
        </Grid.Col>
        <Grid.Col span={12}>
          <Stack>
            <Title order={2}>Attribute Info</Title>
            <Tabs defaultValue={"events"} keepMounted={false}>
              <Tabs.List>
                <Tabs.Tab value="events">Events</Tabs.Tab>
                <Tabs.Tab value="objects">Objects</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="events">
                <AttributeTable ocelId={id} entityType="events" />
              </Tabs.Panel>
              <Tabs.Panel value="objects">
                <AttributeTable ocelId={id} entityType="objects" />
              </Tabs.Panel>
            </Tabs>
          </Stack>
        </Grid.Col>
        <Grid.Col span={6}>
          <Stack>
            <Title order={2}>Activities</Title>
            <EntityBarList type="events" ocelId={id} />
          </Stack>
        </Grid.Col>
        <Grid.Col span={6}>
          <Stack>
            <Title order={2}>Object Types</Title>
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
