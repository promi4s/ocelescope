import { defineModule } from "@ocelescope/core";
import { BinocularsIcon } from "lucide-react";
import logOverview from "./pages/logOverview";

export default defineModule({
  name: "logOverview",
  description: "A tool for inspecting OCELs",
  label: "Log Overview",
  authors: [{ name: "Öztürk, Görkem-Emre" }],
  routes: [logOverview],
  icon: BinocularsIcon,
});
