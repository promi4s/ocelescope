import { defineModule } from "@ocelescope/core";
import { BinocularsIcon } from "lucide-react";
import exploration from "./pages/exploration";
import logOverview from "./pages/logOverview";

export default defineModule({
  name: "logOverview",
  description: "A tool for inspecting OCELs",
  label: "Log Overview",
  authors: [{ name: "Öztürk, Görkem-Emre" }],
  routes: [logOverview, exploration],
  icon: BinocularsIcon,
});
