import { useEffect, useMemo, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getAccessToken, getApiBaseUrl } from "@/lib/api";

export interface RealtimeEvent<TPayload = unknown> {
  event_name: string;
  payload: TPayload;
  published_at: string;
}

export function useRealtimeSync(
  eventNames: string[],
  onEvent: (event: RealtimeEvent) => void,
) {
  const eventNameKey = useMemo(() => eventNames.join("|"), [eventNames]);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const accessToken = getAccessToken();
    const eventNameList = eventNameKey.split("|").filter(Boolean);
    if (!accessToken || eventNameList.length === 0) return;

    let socket: Socket | null = null;
    let source: EventSource | null = null;
    const subscribedEvents = new Set(eventNameList);

    const handleEvent = (event: RealtimeEvent) => {
      if (subscribedEvents.has(event.event_name)) {
        onEventRef.current(event);
      }
    };

    const startSseFallback = () => {
      if (source) return;
      const params = new URLSearchParams({ access_token: accessToken });
      source = new EventSource(`${getApiBaseUrl()}/events/stream?${params.toString()}`);

      source.onmessage = (message) => {
        try {
          handleEvent(JSON.parse(message.data) as RealtimeEvent);
        } catch {
          // Ignore malformed realtime messages and keep the stream alive.
        }
      };

      for (const eventName of eventNameList) {
        source.addEventListener(eventName, (message) => {
          try {
            onEventRef.current(JSON.parse(message.data) as RealtimeEvent);
          } catch {
            // Ignore malformed realtime messages and keep the stream alive.
          }
        });
      }
    };

    const params = new URLSearchParams({ access_token: accessToken });
    const websocketBaseUrl = new URL(getApiBaseUrl()).origin;
    socket = io(`${websocketBaseUrl}/events`, {
      auth: { token: accessToken },
      query: Object.fromEntries(params.entries()),
      transports: ["websocket"],
      reconnection: true,
    });

    socket.on("connect_error", startSseFallback);
    socket.on("message", handleEvent);

    for (const eventName of eventNameList) {
      socket.on(eventName, (event: RealtimeEvent) => onEventRef.current(event));
    }

    return () => {
      source?.close();
      socket?.disconnect();
    };
  }, [eventNameKey]);
}
