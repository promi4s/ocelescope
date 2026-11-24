import type { ComponentType } from "react";

export type UploadExtras = Record<string, string>;

export type UploadOption = {
  fileExtension: string[];
  input: ComponentType<{
    file: File;
    value: UploadExtras;
    onChange: (next: UploadExtras) => void;
  }>;
};
