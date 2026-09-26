import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem("cc_token");
    const url = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    socket = io(url, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket"],
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
