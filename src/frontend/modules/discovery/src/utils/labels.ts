import type { DiscoveryMethodMeta } from "@ocelescope/api-base";

export const getResourceLabel = (resourceType: string) => {
  if (resourceType === "DirectlyFollowsGraph") return "DFG";
  if (resourceType === "PetriNet") return "Petri Net";
  return resourceType;
};

export const getMethodOptionLabel = (method: DiscoveryMethodMeta) =>
  `${getResourceLabel(method.resourceType)}: ${method.name}`;
