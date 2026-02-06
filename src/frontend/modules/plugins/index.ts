import { defineModule } from "@/lib/modules";
import { PuzzleIcon } from "lucide-react";
import pluginRoute from "./pages";

export default defineModule({
  name: "plugins",
  description: "Run process mining plugins inside ocelescope",
  label: "Plugins",
  authors: [{ name: "Öztürk, Görkem-Emre" }],
  routes: [pluginRoute],
  icon: PuzzleIcon,
});
