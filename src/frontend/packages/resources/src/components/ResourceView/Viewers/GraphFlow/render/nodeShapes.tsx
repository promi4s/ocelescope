import type { GraphNode } from "@ocelescope/api-base";
import type { ReactNode } from "react";
import { MARKING_DOT_SIZE } from "../model/types";

const InnerSymbol = ({
  symbol,
  color,
}: {
  symbol: "triangle" | "square";
  color: string;
}) => {
  if (symbol === "triangle") {
    return (
      <div
        style={{
          width: 0,
          height: 0,
          borderTop: `${MARKING_DOT_SIZE * 0.6}px solid transparent`,
          borderBottom: `${MARKING_DOT_SIZE * 0.6}px solid transparent`,
          borderLeft: `${MARKING_DOT_SIZE}px solid ${color}`,
          marginLeft: 2,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: MARKING_DOT_SIZE,
        height: MARKING_DOT_SIZE,
        backgroundColor: color,
      }}
    />
  );
};

const CLIP_PATH: Partial<Record<GraphNode["shape"], string>> = {
  triangle: "polygon(50% 0, 100% 100%, 0 100%)",
  diamond: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
  hexagon: "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)",
};

export const CircleShape = ({
  width,
  height,
  color,
  borderColor,
  doubleBorder,
  innerSymbol,
  initialTokens,
  finalTokens,
  centerLabel,
}: {
  width: number;
  height: number;
  color: string;
  borderColor: string | null;
  doubleBorder: boolean | null;
  innerSymbol: "triangle" | "square" | null;
  initialTokens: number | null;
  finalTokens: number | null;
  centerLabel: string | null;
}) => (
  <div
    style={{
      position: "relative",
      boxSizing: "border-box",
      width,
      height,
      borderRadius: "50%",
      backgroundColor: color,
      border: borderColor ? `2px solid ${borderColor}` : "none",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    }}
  >
    {doubleBorder && (
      <div
        style={{
          position: "absolute",
          inset: 5,
          borderRadius: "50%",
          border: borderColor ? `2px solid ${borderColor}` : "none",
          pointerEvents: "none",
        }}
      />
    )}
    {initialTokens &&
      !innerSymbol &&
      (initialTokens === 1 ? (
        <div
          style={{
            width: MARKING_DOT_SIZE,
            height: MARKING_DOT_SIZE,
            borderRadius: "50%",
            backgroundColor: "rgba(0,0,0,0.65)",
          }}
        />
      ) : (
        <span
          style={{
            color: "#111",
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {initialTokens}
        </span>
      ))}
    {finalTokens && finalTokens > 1 && (
      <span
        style={{
          position: "absolute",
          right: 4,
          bottom: 3,
          color: "#111",
          fontSize: 9,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {finalTokens}
      </span>
    )}
    {innerSymbol && (
      <InnerSymbol symbol={innerSymbol} color={borderColor ?? "#111"} />
    )}
    {centerLabel && (
      <span
        style={{
          maxWidth: width - 6,
          color: "#111",
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1,
          overflow: "hidden",
          textAlign: "center",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {centerLabel}
      </span>
    )}
  </div>
);

export const BoxShape = ({
  shape,
  color,
  borderColor,
  doubleBorder,
  innerSymbol,
  width,
  height,
  children,
}: {
  shape: Exclude<GraphNode["shape"], "circle">;
  color: string;
  borderColor: string | null;
  doubleBorder: boolean | null;
  innerSymbol: "triangle" | "square" | null;
  width: number | null;
  height: number | null;
  children?: ReactNode;
}) => {
  const clipPath = CLIP_PATH[shape];
  const hasBorder = borderColor != null;

  return (
    <div
      style={{
        position: "relative",
        boxSizing: "border-box",
        width: width ?? undefined,
        height: height ?? undefined,
        padding: hasBorder ? 2 : 0,
        backgroundColor: borderColor ?? "transparent",
        borderRadius: shape === "rectangle" ? 5 : 0,
        clipPath,
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          width: "100%",
          height: "100%",
          backgroundColor: color,
          borderRadius: shape === "rectangle" ? 3 : 0,
          clipPath,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {innerSymbol && !children ? (
          <InnerSymbol symbol={innerSymbol} color="#111" />
        ) : (
          children
        )}
      </div>
      {doubleBorder && (
        <div
          style={{
            position: "absolute",
            inset: 6,
            border: borderColor ? `1.5px solid ${borderColor}` : "none",
            borderRadius: shape === "rectangle" ? 3 : 0,
            clipPath,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};
