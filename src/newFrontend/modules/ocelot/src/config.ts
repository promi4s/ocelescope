import { defineModule } from "@ocelescope/core";

export default defineModule({
  name: "ocelot",
  description:
    "A tool for exploring object-centric event logs, allowing yout to search events and objects and visualize their relationships and attributes.",
  label: "Ocelot",
  authors: [{ name: "Öztürk, Görkem-Emre" }],
  routes: [eventRoute, objectsRoute, eventOverviewRoute, objectsOverviewRoute],
  icon: OcelotIcon,
});
