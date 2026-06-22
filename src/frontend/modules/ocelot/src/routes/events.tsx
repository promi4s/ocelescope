import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import EntityPage from "../components/EntityPage";

const EventPage: React.FC = () => {
  const { id } = useCurrentOcel();
  return (
    <EntityPage
      key={id}
      ocelId={id ?? ""}
      type="events"
      title="Event Inspector"
      description="Browse the individual events in this log. Pick an event type to see its records in a table, with their attributes and the objects they have a relation with."
    />
  );
};

export default defineModuleRoute({
  component: EventPage,
  label: "Events",
  name: "events",
  requiresOcel: true,
});
