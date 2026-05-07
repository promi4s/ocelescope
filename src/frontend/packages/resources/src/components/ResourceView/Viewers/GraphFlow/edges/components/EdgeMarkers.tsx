import { colorToId } from "../../utils/color";
import { ArrowMarker } from "./ArrowMarker";
import type { EdgeArrow } from "../types";

export const getMarkerIds = ({
  color,
  startArrow,
  endArrow,
}: {
  color: string;
  startArrow: EdgeArrow;
  endArrow: EdgeArrow;
}) => {
  const colorKey = colorToId(color);
  return {
    startMarkerId: startArrow ? `arrow-start-${startArrow}-${colorKey}` : null,
    endMarkerId: endArrow ? `arrow-end-${endArrow}-${colorKey}` : null,
  };
};

export const EdgeMarkers = ({
  color,
  startArrow,
  endArrow,
  startMarkerId,
  endMarkerId,
}: {
  color: string;
  startArrow: EdgeArrow;
  endArrow: EdgeArrow;
  startMarkerId: string | null;
  endMarkerId: string | null;
}) => (
  <defs>
    {endMarkerId && (
      <ArrowMarker id={endMarkerId} type={endArrow} color={color} isStart={false} />
    )}
    {startMarkerId && (
      <ArrowMarker id={startMarkerId} type={startArrow} color={color} isStart />
    )}
  </defs>
);
