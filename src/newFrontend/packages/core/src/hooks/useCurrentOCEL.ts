import { useGetOcels } from "@ocelescope/api-base";
import { useEffect } from "react";
import useCurrentOcelStore from "../store/currentOcelStore";

export const useCurrentOcel = () => {
  const { data: ocels = [] } = useGetOcels();
  const { ocelId, setOcel, clearOcel } = useCurrentOcelStore();

  useEffect(() => {
    if (ocelId && !ocels?.some(({ id }) => id === ocelId)) {
      clearOcel();
    }

    if (!ocelId && ocels[0]) {
      setOcel(ocels[0].id);
    }
  }, [clearOcel, setOcel, ocels, ocelId]);

  return { id: ocelId, setCurrentOcel: setOcel };
};
