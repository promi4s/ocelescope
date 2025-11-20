import { useGetOcels } from "@/api/fastapi/ocels/ocels";
import useCurrentOcelStore from "@/store/currentOcelStore";
import { useEffect } from "react";

const useCurrentOcel = () => {
  const { data: ocels = [] } = useGetOcels();
  const { ocelId, setOcel, clearOcel } = useCurrentOcelStore();

  useEffect(() => {
    if (ocelId && !ocels?.some(({ id }) => id === ocelId)) {
      clearOcel();
    }

    if (!ocelId && ocels.length > 0) {
      setOcel(ocels[0].id);
    }
  }, [clearOcel, setOcel, ocels, ocelId]);

  return { id: ocelId, setCurrentOcel: setOcel };
};

export default useCurrentOcel;
