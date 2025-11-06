import useInvalidate from "@/hooks/useInvalidateResources";
import { WebSocketMessage } from "@/lib/websocket/validator";
import useSessionStore from "@/store/sessionStore";
import { showNotification } from "@mantine/notifications";
import { useEffect } from "react";

const SSEWrapper = () => {
  const { sessionId } = useSessionStore();

  const invalidate = useInvalidate();

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const es = new EventSource(`/api/events?sessionId=${sessionId}`);

    //TODO: Use message names
    es.onmessage = (event) => {
      const result = WebSocketMessage.safeParse(JSON.parse(event.data));

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
