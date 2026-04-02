import { defineModule } from "@ocelescope/core";
import OcelotIcon from "./components/OcelotIcon";
import eventOverviewRoute from "./routes/eventOverview";
import eventRoute from "./routes/events";
import objectsOverviewRoute from "./routes/objectOverview";
import objectsRoute from "./routes/objects";
import logOverview from "./routes/logOverview";

export default defineModule({
  name: "ocelot",
  description:
    "A tool for exploring object-centric event logs, allowing yout to search events and objects and visualize their relationships and attributes.",
  label: "Ocelot",
  authors: [{ name: "Öztürk, Görkem-Emre" }],
  routes: [
    logOverview,
    eventRoute,
    objectsRoute,
    eventOverviewRoute,
    objectsOverviewRoute,
  ],
  icon: OcelotIcon,
});
