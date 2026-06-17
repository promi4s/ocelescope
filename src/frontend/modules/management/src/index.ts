import { defineModule } from "@ocelescope/core";
import ResourceManagementPage from "./pages/ResourceManagementPage";

export default defineModule({
  name: "management",
  description: "A tool for managing Resources and OCEL",
  label: "Resources",
  authors: [{ name: "Öztürk, Görkem-Emre" }],
  routes: [ResourceManagementPage],
});
