import { useCurrentOcel } from "../../../hooks/useCurrentOCEL";

/** The OCEL a picker reads: the one it was given, else the selected one. */
export const useOcelId = (ocelId: string | undefined) => {
  const current = useCurrentOcel();
  return ocelId ?? current.id;
};
