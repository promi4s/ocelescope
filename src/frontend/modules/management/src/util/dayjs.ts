import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";

dayjs.extend(isBetween);

export default dayjs;

export const formatDateTime = (dateString: string) =>
  dayjs(dateString).format("YYYY-MM-DD HH:mm");

export const formatDate = (dateString: string) =>
  dayjs(dateString).format("YYYY-MM-DD");
