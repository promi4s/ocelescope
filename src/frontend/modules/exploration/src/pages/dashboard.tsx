import { LoadingOverlay } from "@mantine/core";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import { ExplorationDashboard } from "../components/ExplorationDashboard";

const DashboardPage = () => {
  const { id } = useCurrentOcel();
  return id ? (
    <ExplorationDashboard key={id} ocelId={id} />
  ) : (
    <LoadingOverlay visible />
  );
};

export default defineModuleRoute({
  component: DashboardPage,
  label: "Dashboard",
  name: "dashboard",
  requiresOcel: true,
});
