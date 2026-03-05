import { defineModule } from "@ocelescope/core";
import { PuzzleIcon } from "lucide-react";

export default defineModule({
  name: "plugins",
  description: "Run process mining plugins inside ocelescope",
  label: "Plugins",
  authors: [{ name: "Öztürk, Görkem-Emre" }],
  routes: [],
  icon: PuzzleIcon,
});
