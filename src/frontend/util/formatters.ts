import dayjs from "dayjs";

export const formatDateTime = (dateString: string) =>
  dayjs(dateString).format("YYYY-MM-DD HH:mm");

export const formatDate = (dateString: string) =>
  dayjs(dateString).format("YYYY-MM-DD");
