import {
  getDownloadFlatLogQueryKey,
  getDownloadOCELQueryKey,
  getDownloadResourceQueryKey,
} from "@ocelescope/api-base";
import { env, useSessionStore } from "@ocelescope/api-client";
import { parse } from "content-disposition-attachment";
import { saveAs } from "file-saver";
import qs from "qs";

export const useDownloadFile = () => {
  const { sessionId } = useSessionStore();

  const downloadFile = async (path: string) => {
    try {
      const response = await fetch(path, {
        method: "GET",
        headers: { [env.session_id]: sessionId ?? "" },
      });

      if (!response.ok) {
        throw new Error("Failed to download file");
      }

      const blob = await response.blob();

      const contentDisposition = parse(
        response.headers.get("Content-Disposition") ?? "",
      );

      const fileName = contentDisposition.attachment
        ? contentDisposition.filename
        : "fileName";

      saveAs(blob, fileName);
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  return downloadFile;
};

const useDownloadFromServer =
  <T extends (...args: any[]) => readonly [string, ...any[]]>(getQueryKey: T) =>
  () => {
    const downloadFile = useDownloadFile();

    return {
      download: (...params: Parameters<T>) => {
        const result = getQueryKey(...params);
        const path = result[0];
        const searchParams = result[1];

        const queryString = qs.stringify(searchParams, {
          skipNulls: true,
          indices: false,
        });

        downloadFile(queryString ? `${path}?${queryString}` : path);
      },
    };
  };

export const useDownloadOCEL = useDownloadFromServer(getDownloadOCELQueryKey);

export const useDownloadFlatOCEL = useDownloadFromServer(
  getDownloadFlatLogQueryKey,
);

export const useDownloadResource = useDownloadFromServer(
  getDownloadResourceQueryKey,
);
