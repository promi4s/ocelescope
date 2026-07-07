import { defineModule } from "@ocelescope/core";
import { WaypointsIcon } from "lucide-react";
import variants from "./pages/variants";

export default defineModule({
  name: "variants",
  description:
    "Explore object trace variants and their per-variant event and case counts.",
  label: "Variants",
  authors: [{ name: "Öztürk, Görkem-Emre" }],
  routes: [variants],
  icon: WaypointsIcon,
});
