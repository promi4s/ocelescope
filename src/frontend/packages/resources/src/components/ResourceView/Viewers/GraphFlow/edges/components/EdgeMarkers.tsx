import { colorToId } from "../../utils/color";
import { ArrowMarker, type EdgeArrow } from "./ArrowMarker";

export const getMarkerIds = ({
  color,
  startArrow,
  endArrow,
}: {
  color: string;
  startArrow: EdgeArrow | null;
  endArrow?: EdgeArrow | null;
}) => {
  const colorKey = colorToId(color);
  return {
    startMarkerId: startArrow ? `arrow-start-${startArrow}-${colorKey}` : null,
    endMarkerId: endArrow ? `arrow-end-${endArrow}-${colorKey}` : null,
  };
};

//TODO: Fix the null mess
export const EdgeMarkers = ({
  color,
  startArrow,
  endArrow,
  startMarkerId,
  endMarkerId,
}: {
  color: string;
  startArrow: EdgeArrow | null;
  endArrow: EdgeArrow | null;
  startMarkerId: string | null;
  endMarkerId: string | null;
}) => (
  <defs>
    {endMarkerId && endArrow && (
      <ArrowMarker
        id={endMarkerId}
        type={endArrow}
        color={color}
        isStart={false}
      />
    )}
    {startMarkerId && startArrow && (
      <ArrowMarker id={startMarkerId} type={startArrow} color={color} isStart />
    )}
  </defs>
);
