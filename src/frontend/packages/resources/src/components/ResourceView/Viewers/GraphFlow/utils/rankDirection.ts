import type { ElkDirection, RankDirection } from "../types/graphFlow";

export const rankdirToElkDirection = (
  rankdir?: RankDirection,
): ElkDirection => {
  switch (rankdir) {
    case "LR":
      return "RIGHT";
    case "RL":
      return "LEFT";
    case "BT":
      return "UP";
    default:
      return "DOWN";
  }
};
