import { defineModuleRoute } from "@ocelescope/core";
import EntityPage from "../components/EntityPage";

const ObjectPage = () => <EntityPage type="objects" />;

export default defineModuleRoute({
  component: ObjectPage,
  label: "Objects",
  name: "objects",
  requiresOcel: true,
});
