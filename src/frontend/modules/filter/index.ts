import { defineModule } from "@/lib/modules";

import FilterPage from "./pages";
import { FilterIcon } from "lucide-react";
export default defineModule({
  name: "filter",
  description: "Filter functionality provided by the ocelescope package",
  label: "Filters",
  authors: [{ name: "Öztürk, Görkem-Emre" }],
  routes: [FilterPage],
  icon: FilterIcon,
});
