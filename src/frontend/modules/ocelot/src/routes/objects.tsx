import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import EntityPage from "../components/EntityPage";

const ObjectPage: React.FC = () => {
  const { id } = useCurrentOcel();
  return <EntityPage key={id} ocelId={id ?? ""} type="objects" />;
};
export default defineModuleRoute({
  component: ObjectPage,
  label: "Objects",
  name: "objects",
  requiresOcel: true,
});
