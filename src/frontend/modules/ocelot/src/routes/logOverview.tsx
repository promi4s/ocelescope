import { LoadingOverlay } from "@mantine/core";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import OCELInfo from "../components/OcelInfo";
import AttributeTable from "../components/AttributeTable";

const LogOverviewPage = () => {
  const { id } = useCurrentOcel();
  if (!id) {
    return <LoadingOverlay />;
  }
  return (
    <>
      <OCELInfo ocelId={id} />
      <AttributeTable ocelId={id} />
    </>
  );
};

export default defineModuleRoute({
  component: LogOverviewPage,
  label: "Log Overview",
  name: "logOverview",
  requiresOcel: true,
});
