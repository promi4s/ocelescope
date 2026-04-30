import { defineModule } from "@ocelescope/core";
import caseCentricView from "./pages/caseCentricView";

export default defineModule({
  authors: [{ name: "Görkem-Emre Öztürk" }],
  description: "A module for inspecting executions in process mining",
  name: "executions",
  label: "Executions",
  routes: [caseCentricView],
});
