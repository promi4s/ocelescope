import { defineModuleRoute } from "@ocelescope/core";
import EntityPage from "../components/EntityPage";

const EventPage = () => <EntityPage type="events" />;

export default defineModuleRoute({
  component: EventPage,
  label: "Events",
  name: "events",
  requiresOcel: true,
});
