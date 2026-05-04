import { Card, LoadingOverlay } from "@mantine/core";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import { useState } from "react";
import { EntityTypeSelect } from "../../components/EntitiySelect";
import { ObjectVariantList } from "../../components/ObjectVariantList/ObjectVariantList";
import classes from "./CaseCetricView.module.css";

const CaseCentricView = () => {
  const { id } = useCurrentOcel();

  const [currentObjectType, setCurrentObjectType] = useState<string | null>(
    null,
  );

  if (!id) {
    return <LoadingOverlay />;
  }

  return (
    <div className={classes.layout}>
      <div className={classes.main}>
        <ObjectVariantList
          key={`variantList_${id}_${currentObjectType}`}
          ocelId={id}
          objectType={currentObjectType ?? ""}
        />
      </div>
      <Card shadow="md" className={classes.sideBar ?? ""}>
        <EntityTypeSelect
          key={`entitySelect_${id}`}
          label="Object Type"
          entityType="objects"
          value={currentObjectType}
          onChange={(newObjectType) => setCurrentObjectType(newObjectType)}
          ocelId={id}
        />
      </Card>
    </div>
  );
};

export default defineModuleRoute({
  name: "caseCentric",
  label: "Case Centric",
  component: CaseCentricView,
  requiresOcel: true,
});
