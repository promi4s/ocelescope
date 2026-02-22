import EntityPage from "../components/EntityPage";
import { defineModuleRoute } from "@ocelescope/core";

const EventPage = () => <EntityPage type="events" />;

export default defineModuleRoute({
  component: EventPage,
  label: "Events",
  name: "events",
  requiresOcel: true,
});
