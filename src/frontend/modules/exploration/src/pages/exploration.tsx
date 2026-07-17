import { Container, LoadingOverlay } from "@mantine/core";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";

import { ExplorationDashboard } from "../components/ExplorationDashboard";

const ExplorationPage = () => {
  const { id } = useCurrentOcel();
  if (!id) return <LoadingOverlay />;

  return (
    <Container fluid>
      <ExplorationDashboard key={id} ocelId={id} />
    </Container>
  );
};

export default defineModuleRoute({
  component: ExplorationPage,
  label: "Exploration",
  name: "exploration",
  requiresOcel: true,
});
