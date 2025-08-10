import { WebSocketMessage } from "@/lib/websocket/validator";
import { showNotification } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

const WebsocketWrapper = () => {
  const ws = useRef<WebSocket | null>(null);

  const queryClient = useQueryClient();
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      ws.current = new WebSocket("ws://localhost:8000/ws");

      ws.current.onopen = () => {
        console.log("Connected to WebSocket");
      };

      ws.current.onmessage = (event) => {
        const result = WebSocketMessage.safeParse(JSON.parse(event.data));

        if (!result.success) {
          console.warn("Invalid WS message", result.error);
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
            queryClient.invalidateQueries({
              predicate: (query) =>
                typeof query.queryKey[0] === "string" &&
                message.routes.some((route) =>
                  (query.queryKey[0] as string).includes(`/${route}`),
                ),
            });
        }
      };

      const scheduleReconnect = () => {
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 3000);
        }
      };

      ws.current.onclose = () => {
        console.warn("WebSocket closed, retrying...");
        scheduleReconnect();
      };

      ws.current.onerror = () => {
        console.error("WebSocket error, closing & retrying...");
        ws.current?.close(); // will trigger onclose and reconnect
      };
    };

    connect();

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      ws.current?.close();
    };
  }, []);

  return null;
};

export default WebsocketWrapper;
