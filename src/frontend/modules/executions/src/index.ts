import { defineModule } from "@ocelescope/core";
import caseCentricView from "./pages/CaseCentricView/CaseCentricView";

export default defineModule({
  authors: [{ name: "Görkem-Emre Öztürk" }],
  description: "A module for inspecting executions in process mining",
  name: "executions",
  label: "Executions",
  routes: [caseCentricView],
});
