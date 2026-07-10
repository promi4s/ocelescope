import { useReactFlow } from "@xyflow/react";
import { type RefObject, useCallback } from "react";
import {
  downloadPdf as savePdf,
  downloadPng as savePng,
  downloadSvg as saveSvg,
} from "../utils/download";

export const useGraphExport = (
  wrapperRef: RefObject<HTMLDivElement | null>,
) => {
  const { getNodes, getNodesBounds } = useReactFlow();

  const downloadPng = useCallback(() => {
    if (!wrapperRef.current) return;
    void savePng(wrapperRef.current, getNodes(), getNodesBounds);
  }, [wrapperRef, getNodes, getNodesBounds]);

  const downloadSvg = useCallback(() => {
    if (!wrapperRef.current) return;
    void saveSvg(wrapperRef.current, getNodes(), getNodesBounds);
  }, [wrapperRef, getNodes, getNodesBounds]);

  const downloadPdf = useCallback(() => {
    if (!wrapperRef.current) return;
    void savePdf(wrapperRef.current, getNodes(), getNodesBounds);
  }, [wrapperRef, getNodes, getNodesBounds]);

  return { downloadPng, downloadSvg, downloadPdf };
};
