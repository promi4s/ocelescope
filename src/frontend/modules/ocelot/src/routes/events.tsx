import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import EntityPage from "../components/EntityPage";

const EventPage: React.FC = () => {
  const { id } = useCurrentOcel();
  return <EntityPage key={id} ocelId={id ?? ""} type="events" />;
};

export default defineModuleRoute({
  component: EventPage,
  label: "Events",
  name: "events",
  requiresOcel: true,
});
