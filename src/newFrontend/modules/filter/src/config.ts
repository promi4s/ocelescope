import { defineModule } from "@ocelescope/core";

import { FilterIcon } from "lucide-react";
import FilterPage from "./components/FilterPage";

export default defineModule({
  name: "filter",
  description: "Filter functionality provided by the ocelescope package",
  label: "Filters",
  authors: [{ name: "Öztürk, Görkem-Emre" }],
  routes: [FilterPage],
  icon: FilterIcon,
});
