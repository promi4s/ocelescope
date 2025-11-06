import type { NextApiRequest, NextApiResponse } from "next";
import { Readable } from "stream";
import type { ReadableStream as NodeReadableStream } from "stream/web";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session_id = req.query.sessionId as string;
  const backendUrl = `http://backend:8000/sse?session_id=${encodeURIComponent(session_id || "")}`;

  try {
    const controller = new AbortController();

    const backendRes = await fetch(backendUrl, {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal,
    });

    if (!backendRes.body) {
      res.status(502).end("No response body from backend");
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const webStream = backendRes.body as unknown as NodeReadableStream;
    const nodeStream = Readable.fromWeb(webStream);
    nodeStream.pipe(res);

    res.on("close", () => {
      console.log("Client disconnected");
      controller.abort();
      nodeStream.destroy();
      res.end();
    });
  } catch (err) {
    console.error("SSE proxy error:", err);
    res.status(500).end("SSE proxy error");
  }
}
