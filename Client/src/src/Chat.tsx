import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { IoChatbubbleOutline } from "react-icons/io5";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoom } from "@/context/RoomContext";
import toast from "react-hot-toast";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { IoCopyOutline } from "react-icons/io5";

type Message = {
  type: "chat" | "user-joined" | "user-left" | "user-list" | "error";
  payload: {
    userName?: string;
    message?: string;
    users?: string[];
  };
};

function Chat() {
  const navigate = useNavigate();
  const { roomCode, userName } = useRoom();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // @ts-ignore
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Redirect to “/” if context is empty (e.g. on page refresh)
  useEffect(() => {
    if (!roomCode || !userName) {
      navigate("/", { replace: true });
    }
  }, [roomCode, userName, navigate]);

  const [messages, setMessages] = useState<Message[]>([
    // {
    //   type: "chat",
    //   payload: {
    //     userName: "Server",
    //     message: "Hello from the server!",
    //   },
    // },
  ]);

  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const ws = new WebSocket("wss://chat-app-deep-server.onrender.com");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      if (roomCode && userName) {
        ws.send(
          JSON.stringify({
            type: "join",
            payload: { roomId: roomCode, userName },
          })
        );
        // ✅ Show success toast only to this user
        toast.success("You have successfully joined!");
      }
    };

    ws.onmessage = (event) => {
      try {
        const data: Message = JSON.parse(event.data);

        switch (data.type) {
          case "chat":
          case "user-joined":
          case "user-left":
            setMessages((prev) => [...prev, data]);

            if (data.type === "user-joined") {
              setUsers((prev) => [
                ...new Set([...prev, data.payload.userName!]),
              ]);
            }

            if (data.type === "user-left") {
              setUsers((prev) =>
                prev.filter((u) => u !== data.payload.userName)
              );
            }
            break;

          case "user-list":
            setUsers(data.payload.users || []);
            break;

          case "error":
            toast.error(data.payload.message || "An error occurred");
            wsRef.current?.close(); // Optional: close the socket if error
            break;

          default:
            console.warn("Unhandled WebSocket message type:", data.type);
        }
      } catch (err) {
        console.error("Failed to parse message:", event.data);
      }
    };

    ws.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
    };

    ws.onclose = () => {
      console.warn("⚠️ WebSocket connection closed");
    };

    return () => {
      ws.close();
    };
  }, [roomCode, userName]);

  const sendMessage = () => {
    if (wsRef.current && message.trim()) {
      wsRef.current.send(
        JSON.stringify({
          type: "chat",
          payload: { message, userName },
        })
      );
      setMessage("");
    }
  };

  return (
    <Card className="rounded-xl border w-full max-w-2xl mx-auto mt-4 sm:mt-2">
      {/* Top-right corner toggle */}
      <div className="absolute top-5 sm:top-4 right-4 z-10">
        <ModeToggle />
      </div>

      <CardHeader>
        <div className="flex items-center gap-2">
          <IoChatbubbleOutline className="text-2xl" />
          <CardTitle className="text-2xl">Real Time Chat</CardTitle>
        </div>
        <CardDescription className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Temporary room that expires after all users exit
        </CardDescription>
      </CardHeader>

      {/* Room code and user count */}
      <CardContent className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 backdrop-blur-md bg-gray-100 dark:bg-white/10 border rounded-lg p-3 mx-5">
        <div className="flex items-center flex-wrap gap-2">
          <span>Room Code:</span>
          <span className="font-mono">{roomCode}</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            title="Copy Room Code"
          >
            <IoCopyOutline className="w-5 h-5" />
          </Button>
          {copied && (
            <span className="text-sm text-green-500 font-medium">Copied!</span>
          )}
        </div>
        <p className="text-sm sm:text-base">Users: {users.length}</p>
      </CardContent>

      {/* Chat messages */}
      <CardContent className="h-[60vh] overflow-y-auto flex flex-col border rounded-lg mx-5">
        {messages.map((msg, idx) => {
          const isSelf = msg.payload.userName === userName;

          if (msg.type === "chat") {
            const prevMsg = messages[idx - 1];
            const showUserName =
              idx === 0 ||
              prevMsg?.type !== "chat" ||
              prevMsg?.payload.userName !== msg.payload.userName;

            return (
              <div
                key={idx}
                className={`flex flex-col ${
                  isSelf ? "items-end" : "items-start"
                } mx-0 my-1`}
              >
                {showUserName && (
                  <span className="text-xs text-gray-400 mb-1">
                    {msg.payload.userName}
                  </span>
                )}
                <span
                  className={`text-sm rounded p-2 shadow-md max-w-xs break-words ${
                    isSelf
                      ? "bg-blue-600 text-white"
                      : "bg-black text-white dark:bg-white dark:text-black"
                  }`}
                >
                  {msg.payload.message}
                </span>
              </div>
            );
          }

          if (msg.type === "user-joined") {
            return (
              <div
                key={idx}
                className="text-green-500 text-center text-sm my-2"
              >
                👋 {msg.payload.userName} joined the room.
              </div>
            );
          }

          if (msg.type === "user-left") {
            return (
              <div key={idx} className="text-red-500 text-center text-sm my-2">
                ❌ {msg.payload.userName} left the room.
              </div>
            );
          }

          return null;
        })}
      </CardContent>

      <CardFooter className="flex gap-2 px-5">
        {/* Make the input shrink/grow but never force the button off-screen */}
        <div className="flex-1 min-w-0">
          <Input
            ref={inputRef}
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && message.trim()) sendMessage();
            }}
            placeholder="Type a message..."
            className="p-5 w-full"
          />
        </div>

        {/* Fixed‑width button, stays to the right of the input */}
        <Button
          variant="outline"
          className="text-lg w-24 shrink-0 bg-black text-white border border-gray-800 hover:bg-gray-900 dark:bg-white dark:text-black dark:border-gray-300 dark:hover:bg-gray-100 p-5"
          onClick={sendMessage}
        >
          Send
        </Button>
      </CardFooter>
    </Card>
  );
}

export default Chat;
