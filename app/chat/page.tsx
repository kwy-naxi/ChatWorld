"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { io } from "socket.io-client";

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  type?: 'system' | 'user';
}

export default function ChatPage() {
  const [socket, setSocket] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const newSocket = io("http://localhost:3001");
    setSocket(newSocket);

    newSocket.on("receive-message", (message: Message) => {
      setMessages(prev => [...prev, { ...message, type: 'user' }]);
    });

    newSocket.on("user-connected", (data) => {
      setMessages(prev => [...prev, { 
        id: Math.random().toString(),
        text: data.message,
        sender: 'system',
        timestamp: data.timestamp,
        type: 'system'
      }]);
    });

    newSocket.on("user-disconnected", (data) => {
      setMessages(prev => [...prev, { 
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
      sender: "user",
      timestamp: Date.now(),
    };

    socket.emit("send-message", newMessage);
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
          </div>
        ))}
        <div ref={messagesEndRef} />
      </Card>
      
      <div className="flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="메시지를 입력하세요..."
          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
        />
        <Button onClick={handleSendMessage}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
} 