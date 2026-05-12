import dayjs from "dayjs";

export const formatTime = (timestamp?: string) =>
  dayjs(timestamp).format("YYYY-MM-DD HH:mm");
