// hooks/useWebSocket.ts
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

type WebSocketResponse = {
  task_id: string;
  task_message: string;
  output_ids: string[];
  ocel_ids: string[];
};

export const useWebSocket = () => {
  const ws = useRef<WebSocket | null>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    let reconnectTimer: any;

    const connect = () => {
      ws.current = new WebSocket("ws://localhost:8000/ws");

      ws.current.onopen = () => {};

      ws.current.onmessage = async (event) => {
        const message: WebSocketResponse = JSON.parse(event.data);
        if (message.output_ids.length > 0) {
          await queryClient.invalidateQueries({
            predicate: (query) =>
              typeof query.queryKey[0] === "string" &&
              query.queryKey[0].includes("/outputs"),
          });
        }
        if (message.ocel_ids.length > 0) {
          await queryClient.invalidateQueries({
            predicate: (query) =>
              typeof query.queryKey[0] === "string" &&
              query.queryKey[0].includes("/ocels"),
          });
        }
      };

      ws.current.onclose = () => {
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.current.onerror = (err) => {
        ws.current?.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      ws.current?.close();
    };
  }, []);
};
