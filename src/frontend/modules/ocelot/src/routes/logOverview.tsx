import { Grid, LoadingOverlay } from "@mantine/core";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import OCELInfo from "../components/OcelInfo";
import AttributeTable from "../components/AttributeTable";
import { OCELEntityBarList } from "../components/OCELEntityBarList";

const LogOverviewPage = () => {
  const { id } = useCurrentOcel();
  if (!id) {
    return <LoadingOverlay />;
  }
  return (
    <Grid>
      <Grid.Col span={12}>
        <OCELInfo ocelId={id} />
      </Grid.Col>
      <Grid.Col span={12}>
        <AttributeTable ocelId={id} />
      </Grid.Col>
      <Grid.Col span={6}>
        <OCELEntityBarList type="events" ocelId={id} />
      </Grid.Col>
    </Grid>
  );
};

export default defineModuleRoute({
  component: LogOverviewPage,
  label: "Log Overview",
  name: "logOverview",
  requiresOcel: true,
});
