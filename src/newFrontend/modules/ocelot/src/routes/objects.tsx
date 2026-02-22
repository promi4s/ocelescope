import EntityPage from "../components/EntityPage";
import { defineModuleRoute } from "@ocelescope/core";

const ObjectPage = () => <EntityPage type="objects" />;

export default defineModuleRoute({
  component: ObjectPage,
  label: "Objects",
  name: "objects",
  requiresOcel: true,
});
