import useInvalidate from "@/hooks/useInvalidateResources";
import { ServerEventMessage } from "@/lib/websocket/validator";
import useSessionStore from "@/store/sessionStore";
import { env } from "@/util/env";
import { showNotification } from "@mantine/notifications";
import { useEffect } from "react";

const SSEWrapper = () => {
  const { sessionId } = useSessionStore();

  const invalidate = useInvalidate();

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const es = new EventSource(
      `${env.NEXT_PUBLIC_EVENTS_URL}?sessionId=${sessionId}`,
    );

    //TODO: Use message names
    es.onmessage = (event) => {
      const result = ServerEventMessage.safeParse(JSON.parse(event.data));

      if (!result.success) {
        console.warn("Invalid SSE message", result.error);
        return;
      }

      const message = result.data;

      switch (message.type) {
        case "notification":
          showNotification({
            title: message.title,
            message: message.message,
            color: "green",
          });
          break;
        case "invalidation":
          invalidate(message.routes);
      }
    };

    es.onerror = (err) => {
      console.error("SSE error:", err);
    };

    return () => es.close();
  }, [sessionId]);
  return null;
};

export default SSEWrapper;
