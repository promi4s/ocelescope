import EntityPage from "../components/EntityPage";
import { defineModuleRoute } from "@/lib/modules";

const EventPage = () => <EntityPage type="events" />;

export default defineModuleRoute({
  component: EventPage,
  label: "Events",
  name: "events",
  requiresOcel: true,
});
