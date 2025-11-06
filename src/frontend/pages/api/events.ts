import type { NextApiRequest, NextApiResponse } from "next";
import { Readable } from "stream";
import type { ReadableStream as NodeReadableStream } from "stream/web";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session_id = req.query.sessionId as string;

  const backendUrl = `http://backend:8000/sse?session_id=${encodeURIComponent(session_id || "")}`;
  try {
    const backendRes = await fetch(backendUrl, {
      headers: { Accept: "text/event-stream" },
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    if (!backendRes.body) {
      res.status(502).end("No response body from backend");
      return;
    }

    const webStream = backendRes.body as unknown as NodeReadableStream;
    const nodeStream = Readable.fromWeb(webStream);
    nodeStream.pipe(res);

    req.on("close", () => {
      nodeStream.destroy();
      res.end();
    });
  } catch (err) {
    console.error("SSE proxy error:", err);
    res.status(500).end("SSE proxy error");
  }
}
