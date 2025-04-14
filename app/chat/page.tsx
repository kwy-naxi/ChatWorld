"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Edit2, Trash2, X, Check } from "lucide-react";
import { io, Socket } from "socket.io-client";

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  type?: 'system' | 'user';
  isEditing?: boolean;
}

interface SocketData {
  message: string;
  timestamp: number;
}

export default function ChatPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const newSocket = io("http://localhost:3001");
    setSocket(newSocket);

    newSocket.on("receive-message", (message: Message) => {
      setMessages((prev: Message[]) => [...prev, { ...message, type: 'user' }]);
    });

    newSocket.on("message-edited", (data: { messageId: string; newText: string }) => {
      setMessages((prev: Message[]) => prev.map(msg => 
        msg.id === data.messageId 
          ? { ...msg, text: data.newText, isEditing: false }
          : msg
      ));
    });

    newSocket.on("message-deleted", (data: { messageId: string }) => {
      setMessages((prev: Message[]) => prev.filter(msg => msg.id !== data.messageId));
    });

    newSocket.on("user-connected", (data: SocketData) => {
      setMessages((prev: Message[]) => [...prev, { 
        id: Math.random().toString(),
        text: data.message,
        sender: 'system',
        timestamp: data.timestamp,
        type: 'system'
      }]);
    });

    newSocket.on("user-disconnected", (data: SocketData) => {
      setMessages((prev: Message[]) => [...prev, { 
        id: Math.random().toString(),
        text: data.message,
        sender: 'system',
        timestamp: data.timestamp,
        type: 'system'
      }]);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!message.trim() || !socket) return;

    const newMessage: Message = {
      id: Math.random().toString(),
      text: message,
      sender: socket.id,
      timestamp: Date.now(),
    };

    socket.emit("send-message", newMessage);
    setMessage("");
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessage(message);
    setMessage(message.text);
  };

  const handleSaveEdit = () => {
    if (!editingMessage || !socket) return;

    socket.emit("edit-message", {
      messageId: editingMessage.id,
      newText: message
    });

    setEditingMessage(null);
    setMessage("");
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!socket) return;
    socket.emit("delete-message", messageId);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setMessage("");
  };

  return (
    <div className="container mx-auto p-4 h-screen flex flex-col">
      <Card className="flex-1 p-4 mb-4 overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-2 p-2 rounded-lg ${
              msg.type === 'system'
                ? 'bg-gray-100 text-gray-600 text-center text-sm'
                : msg.sender === socket?.id
                ? "bg-blue-500 text-white ml-auto"
                : "bg-gray-200"
            } max-w-[70%] ${msg.type === 'system' ? 'mx-auto' : ''}`}
          >
            {msg.type !== 'system' && <p className="text-xs opacity-75 mb-1">{msg.sender}</p>}
            <p>{msg.text}</p>
            <small className="text-xs opacity-75">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </small>
            {msg.type !== 'system' && msg.sender === socket?.id && (
              <div className="flex gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditMessage(msg)}
                  className="p-1 h-6"
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteMessage(msg.id)}
                  className="p-1 h-6"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </Card>
      
      <div className="flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={editingMessage ? "메시지를 수정하세요..." : "메시지를 입력하세요..."}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              if (editingMessage) {
                handleSaveEdit();
              } else {
                handleSendMessage();
              }
            }
          }}
        />
        {editingMessage ? (
          <>
            <Button onClick={handleSaveEdit}>
              <Check className="h-4 w-4" />
            </Button>
            <Button onClick={handleCancelEdit}>
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button onClick={handleSendMessage}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
} 