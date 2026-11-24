import type { UploadExtras } from "@ocelescope/api-base";
import type { ComponentType } from "react";

export type { UploadExtras };

export type UploadOption = {
  fileExtension: string[];
  input: ComponentType<{
    file: File;
    value: UploadExtras;
    onChange: (next: UploadExtras) => void;
  }>;
};
