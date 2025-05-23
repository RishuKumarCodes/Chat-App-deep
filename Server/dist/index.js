"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const wss = new ws_1.WebSocketServer({ port: 8080 });
let allSockets = [];
wss.on("connection", (socket) => {
    console.log("🔌 New client connected");
    socket.on("message", (message) => {
        try {
            const parsedMessage = JSON.parse(message.toString());
            if (parsedMessage.type === "join") {
                const { roomId, userName } = parsedMessage.payload;
                // Check if username already exists in the room
                const isDuplicate = allSockets.some((user) => user.room === roomId && user.userName === userName);
                if (isDuplicate) {
                    socket.send(JSON.stringify({
                        type: "error",
                        payload: { message: "Username already exists in the room." },
                    }));
                    return; // Don't proceed further
                }
                // Prevent duplicate user entries (e.g., on refresh)
                allSockets = allSockets.filter((user) => user.socket !== socket);
                // Add new user
                allSockets.push({ socket, room: roomId, userName });
                // Get updated user list for this room
                const usersInRoom = allSockets
                    .filter((user) => user.room === roomId)
                    .map((user) => user.userName);
                // Send user list to the new user
                socket.send(JSON.stringify({
                    type: "user-list",
                    payload: { users: usersInRoom },
                }));
                // Broadcast to others in the same room that a new user joined
                allSockets.forEach((user) => {
                    if (user.room === roomId && user.socket !== socket) {
                        user.socket.send(JSON.stringify({
                            type: "user-joined",
                            payload: { userName },
                        }));
                    }
                });
                // 🎉 Send success toast to the user joining
                socket.send(JSON.stringify({
                    type: "success",
                    payload: { message: "Successfully joined the room!" },
                }));
            }
            if (parsedMessage.type === "chat") {
                const sender = allSockets.find((u) => u.socket === socket);
                if (!sender)
                    return;
                allSockets.forEach((user) => {
                    if (user.room === sender.room) {
                        user.socket.send(JSON.stringify({
                            type: "chat",
                            payload: {
                                userName: sender.userName,
                                message: parsedMessage.payload.message,
                            },
                        }));
                    }
                });
            }
        }
        catch (error) {
            console.error("❌ Error parsing message:", error);
        }
    });
    socket.on("close", () => {
        const userIndex = allSockets.findIndex((user) => user.socket === socket);
        if (userIndex !== -1) {
            const { room, userName } = allSockets[userIndex];
            // Remove user from socket list
            allSockets.splice(userIndex, 1);
            // Inform others in the same room
            allSockets.forEach((user) => {
                if (user.room === room) {
                    user.socket.send(JSON.stringify({
                        type: "user-left",
                        payload: { userName },
                    }));
                }
            });
            console.log(`👋 ${userName} left room: ${room}`);
        }
    });
    socket.on("error", (err) => {
        console.error("⚠️ WebSocket error:", err);
    });
});
