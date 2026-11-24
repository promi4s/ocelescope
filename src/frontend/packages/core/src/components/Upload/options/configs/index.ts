import type { UploadOption } from "../types";
import { xesUploadOption } from "./xes/XesUploadOption";

const UPLOAD_OPTION_CONFIG: UploadOption[] = [xesUploadOption];

export const findUploadOption = (file: File) =>
  UPLOAD_OPTION_CONFIG.find(({ fileExtension }) =>
    fileExtension.some((extension) =>
      file.name.toLowerCase().endsWith(`.${extension}`),
    ),
  );
