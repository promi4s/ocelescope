import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Graphviz } from "@hpcc-js/wasm-graphviz";
import { saveAs } from "file-saver";
import type { VisualizationProps } from "../../../types";
import { SvgPanWrapper } from "./SVG";

const DotToSvgViewer: React.FC<VisualizationProps<"dot">> = ({
  isPreview,
  visualization,
}) => {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef({ cancelled: false });

  useEffect(() => {
    cancelRef.current.cancelled = false;
    setError(null);
    setSvg(null);

    (async () => {
      try {
        const gv = await Graphviz.load(); // cached after first call
        const out = gv.layout(
          visualization.dot_str,
          "svg",
          visualization.layout_engine,
        );
        if (!cancelRef.current.cancelled) setSvg(out);
      } catch (e: any) {
        if (!cancelRef.current.cancelled)
          setError(e?.message ?? "Graphviz rendering failed.");
      }
    })();

    return () => {
      cancelRef.current.cancelled = true;
    };
  }, [visualization]);

  // Make SVG responsive & ensure xmlns
  const cleanedSvg = useMemo(() => {
    if (!svg) return null;
    let s = svg
      .replace(/width="[^"]+"/, 'width="100%"')
      .replace(/height="[^"]+"/, 'height="100%"')
      .replace(
        /<svg(?![^>]*xmlns=)/,
        '<svg xmlns="http://www.w3.org/2000/svg"',
      );
    if (!s.trim().startsWith("<?xml")) {
      s = `<?xml version="1.0" encoding="UTF-8"?>\n${s}`;
    }
    return s;
  }, [svg]);

  const handleDownload = () => {
    if (!cleanedSvg) return;
    const blob = new Blob([cleanedSvg], {
      type: "image/svg+xml;charset=utf-8",
    });
    saveAs(blob, "resource.svg");
  };

  const Wrapper = isPreview ? Fragment : SvgPanWrapper;

  return (
    <Wrapper onDownload={handleDownload}>
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        {error && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              color: "red",
              zIndex: 10,
            }}
          >
            Graphviz error: {error}
          </div>
        )}
        {cleanedSvg ? (
          <div
            style={{ width: "100%", height: "100%" }}
            dangerouslySetInnerHTML={{ __html: cleanedSvg }}
          />
        ) : (
          !error && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                placeItems: "center",
                opacity: 0.6,
                fontSize: 14,
              }}
            >
              Rendering…
            </div>
          )
        )}
      </div>
    </Wrapper>
  );
};

export default DotToSvgViewer;
