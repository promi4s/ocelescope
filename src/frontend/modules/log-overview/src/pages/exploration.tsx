import { Container, LoadingOverlay, Stack, Title } from "@mantine/core";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";

import { EventAttributeDistributionPanel } from "../components/EventAttributeDistributionPanel";

const ExplorationPage = () => {
  const { id } = useCurrentOcel();
  if (!id) return <LoadingOverlay />;

  return (
    <Container fluid>
      <Stack>
        <Title order={2}>Event Attribute Distribution</Title>
        <EventAttributeDistributionPanel ocelId={id} />
      </Stack>
    </Container>
  );
};

export default defineModuleRoute({
  component: ExplorationPage,
  label: "Exploration",
  name: "exploration",
  requiresOcel: true,
});
