import { saveAs } from "file-saver";
import { env } from "../util/env";
import useSessionStore from "@/store/sessionStore";

export const useDownloadFile = () => {
  const { sessionId } = useSessionStore();

  const downloadFile = async (path: string) => {
    try {
      const response = await fetch(`${env.backendUrl}${path}`, {
        method: "GET",
        headers: { [env.oceanSessionId]: sessionId ?? "" },
      });

      if (!response.ok) {
        throw new Error("Failed to download file");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "downloaded-file";

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      saveAs(blob, filename);
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  return downloadFile;
};
