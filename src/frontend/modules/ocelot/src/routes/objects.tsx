import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import EntityPage from "../components/EntityPage";

const ObjectPage: React.FC = () => {
  const { id } = useCurrentOcel();
  return (
    <EntityPage
      key={id}
      ocelId={id ?? ""}
      type="objects"
      title="Object Inspector"
      description="Browse the individual objects in this log. Pick an object type to see its records in a table, with their attributes and the objects they have a relation with."
    />
  );
};
export default defineModuleRoute({
  component: ObjectPage,
  label: "Objects",
  name: "objects",
  requiresOcel: true,
});
