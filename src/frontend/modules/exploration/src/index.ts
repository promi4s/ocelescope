import { defineModule } from "@ocelescope/core";
import { ChartNoAxesCombinedIcon } from "lucide-react";
import dashboard from "./pages/dashboard";

export default defineModule({
  name: "exploration",
  description: "Explore the active OCEL through configurable visualizations.",
  label: "Exploration",
  authors: [{ name: "Ocelescope contributors" }],
  routes: [dashboard],
  icon: ChartNoAxesCombinedIcon,
});
