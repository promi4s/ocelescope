import { defineModule } from "@ocelescope/core";
import { ChartNetwork } from "lucide-react";
import Test from "./routes/test";

export default defineModule({
  name: "discovery",
  description:
    "A tool for discovering object-centric event logs, allowing you create various plots like OC-DFGs or OC-Petri-Nets.",
  label: "Discovery",
  authors: [{ name: "Menne, Sebastian" }],
  routes: [Test],
  icon: ChartNetwork,
});
