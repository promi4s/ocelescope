import { LoadingOverlay } from "@mantine/core";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import dynamic from "next/dynamic";

// The cards hold r4pm viewers, which reach for `document` as they load. One
// boundary here keeps every one of them out of the server render.
const Dashboard = dynamic(
  () => import("../Dashboard").then((module) => module.Dashboard),
  { ssr: false },
);

const DashboardPage = () => {
  const { id } = useCurrentOcel();
  return id ? <Dashboard key={id} ocelId={id} /> : <LoadingOverlay visible />;
};

export default defineModuleRoute({
  component: DashboardPage,
  label: "Dashboard",
  name: "dashboard",
  requiresOcel: true,
});
