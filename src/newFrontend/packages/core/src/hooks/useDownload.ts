import { saveAs } from "file-saver";
import { useSessionStore, env } from "@ocelescope/api-client";
import { parse } from "content-disposition-attachment";

export const useDownloadFile = () => {
  const { sessionId } = useSessionStore();

  const downloadFile = async (path: string) => {
    try {
      const response = await fetch(`${env.backend_url}${path}`, {
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
