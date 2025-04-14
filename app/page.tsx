"use client";

import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Plus, Hash, Settings, Trash2, Search, Users, Smile } from "lucide-react";
import { io } from "socket.io-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface User {
  id: string;
  name: string;
  color: string;
}

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  channelId: string;
  reactions?: {
    emoji: string;
    users: string[];
  }[];
}

interface Channel {
  id: string;
  name: string;
  description?: string;
  participants: User[];
}

const EMOJIS = ["👍", "❤️", "😄", "🎉", "🙏", "👀"];

export default function Home() {
  const [socket, setSocket] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, Message[]>>({
    "1": [], // 일반 채널의 메시지
    "2": [], // 랜덤 채널의 메시지
  });
  const [channels, setChannels] = useState<Channel[]>([
    { 
      id: "1", 
      name: "일반", 
      description: "일반적인 대화를 위한 채널입니다.",
      participants: [
        { id: "user1", name: "사용자", color: "purple" },
        { id: "user2", name: "김영희", color: "blue" },
        { id: "user3", name: "이철수", color: "green" }
      ]
    },
    { 
      id: "2", 
      name: "랜덤", 
      description: "자유로운 대화를 위한 채널입니다.",
      participants: [
        { id: "user1", name: "사용자", color: "purple" }
      ]
    }
  ]);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<Channel>(channels[0]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser] = useState<User>({
    id: "user1",
    name: "사용자",
    color: "purple"
  });

  useEffect(() => {
    const newSocket = io("http://localhost:3001");
    setSocket(newSocket);

    newSocket.on("receive-message", (message: Message) => {
      setMessagesByChannel(prev => ({
        ...prev,
        [message.channelId]: [...(prev[message.channelId] || []), message]
      }));
    });

    newSocket.on("user-connected", (data) => {
      const systemMessage = {
        id: Math.random().toString(),
        text: data.message,
        sender: "system",
        timestamp: data.timestamp,
        channelId: selectedChannel.id
      };
      
      setMessagesByChannel(prev => ({
        ...prev,
        [selectedChannel.id]: [...(prev[selectedChannel.id] || []), systemMessage]
      }));
    });

    return () => {
      newSocket.close();
    };
  }, [selectedChannel.id]);

  const handleSendMessage = () => {
    if (!message.trim() || !socket) return;

    const newMessage = {
      id: Math.random().toString(),
      text: message,
      sender: "user",
      timestamp: Date.now(),
      channelId: selectedChannel.id
    };

    socket.emit("send-message", newMessage);
    setMessagesByChannel(prev => ({
      ...prev,
      [selectedChannel.id]: [...(prev[selectedChannel.id] || []), newMessage]
    }));
    setMessage("");
  };

  const handleAddChannel = () => {
    if (!newChannelName.trim()) return;

    const newChannel = {
      id: Math.random().toString(),
      name: newChannelName.trim(),
      description: newChannelDescription.trim() || undefined,
      participants: []
    };

    setChannels(prev => [...prev, newChannel]);
    setMessagesByChannel(prev => ({
      ...prev,
      [newChannel.id]: []
    }));
    setNewChannelName("");
    setNewChannelDescription("");
    setIsDialogOpen(false);
  };

  const handleDeleteChannel = (channelId: string) => {
    if (channels.length <= 1) return; // 최소 1개의 채널은 유지
    
    setChannels(prev => prev.filter(c => c.id !== channelId));
    setMessagesByChannel(prev => {
      const newMessages = { ...prev };
      delete newMessages[channelId];
      return newMessages;
    });

    // 삭제된 채널이 현재 선택된 채널이면 다른 채널로 이동
    if (selectedChannel.id === channelId) {
      const remainingChannel = channels.find(c => c.id !== channelId);
      if (remainingChannel) {
        setSelectedChannel(remainingChannel);
      }
    }
  };

  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel);
    setNewChannelName(channel.name);
    setNewChannelDescription(channel.description || "");
    setIsSettingsOpen(true);
  };

  const handleUpdateChannel = () => {
    if (!editingChannel || !newChannelName.trim()) return;

    setChannels(prev => prev.map(ch => 
      ch.id === editingChannel.id 
        ? { 
            ...ch, 
            name: newChannelName.trim(),
            description: newChannelDescription.trim() || undefined
          }
        : ch
    ));

    if (selectedChannel.id === editingChannel.id) {
      setSelectedChannel({
        ...selectedChannel,
        name: newChannelName.trim(),
        description: newChannelDescription.trim() || undefined
      });
    }

    setIsSettingsOpen(false);
    setEditingChannel(null);
    setNewChannelName("");
    setNewChannelDescription("");
  };

  const handleAddReaction = (messageId: string, emoji: string) => {
    setMessagesByChannel(prev => {
      const channelMessages = prev[selectedChannel.id];
      const messageIndex = channelMessages.findIndex(m => m.id === messageId);
      
      if (messageIndex === -1) return prev;

      const message = channelMessages[messageIndex];
      const reactions = message.reactions || [];
      const existingReaction = reactions.find(r => r.emoji === emoji);

      let updatedReactions;
      if (existingReaction) {
        if (existingReaction.users.includes(currentUser.id)) {
          // 이미 반응한 이모지면 제거
          updatedReactions = reactions.map(r => 
            r.emoji === emoji 
              ? { ...r, users: r.users.filter(u => u !== currentUser.id) }
              : r
          ).filter(r => r.users.length > 0);
        } else {
          // 다른 사용자가 이미 사용한 이모지에 추가
          updatedReactions = reactions.map(r =>
            r.emoji === emoji
              ? { ...r, users: [...r.users, currentUser.id] }
              : r
          );
        }
      } else {
        // 새로운 이모지 반응 추가
        updatedReactions = [...reactions, { emoji, users: [currentUser.id] }];
      }

      const updatedMessages = [...channelMessages];
      updatedMessages[messageIndex] = {
        ...message,
        reactions: updatedReactions
      };

      return {
        ...prev,
        [selectedChannel.id]: updatedMessages
      };
    });
  };

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    channel.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full">
      {/* 사이드바 */}
      <div className="w-64 bg-[#2F0F3D] text-white flex flex-col">
        {/* 워크스페이스 헤더 */}
        <div className="p-4 font-semibold text-lg border-b border-white/10">
          Acme Inc
        </div>

        {/* 채널 검색 */}
        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => setIsSearchOpen(true)}
          >
            <Search className="h-4 w-4 mr-2" />
            채널 검색
          </Button>
        </div>

        {/* 채널 목록 */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            <div className="text-sm text-white/70 px-2 py-2">
              집적 접근 모든 항목
            </div>
            <Button variant="ghost" className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
              <Hash className="h-4 w-4 mr-2" />
              스레드
            </Button>
            <Button variant="ghost" className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
              <Hash className="h-4 w-4 mr-2" />
              멘션 및 반응
            </Button>
            
            <Separator className="my-2 bg-white/10" />
            
            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-sm text-white/70">채널</span>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-4 w-4 text-white/70 hover:text-white">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>새 채널 만들기</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Input
                        placeholder="채널 이름을 입력하세요"
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                      />
                      <Input
                        placeholder="채널 설명 (선택사항)"
                        value={newChannelDescription}
                        onChange={(e) => setNewChannelDescription(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleAddChannel} className="w-full">
                      채널 만들기
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            {channels.map(channel => (
              <div key={channel.id} className="group relative">
                <Button
                  variant="ghost"
                  className={`w-full justify-start ${
                    selectedChannel.id === channel.id
                      ? "bg-white/10 text-white"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                  onClick={() => setSelectedChannel(channel)}
                >
                  <Hash className="h-4 w-4 mr-2" />
                  {channel.name}
                </Button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-white/70 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditChannel(channel);
                    }}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  {channels.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-white/70 hover:text-white hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChannel(channel.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* 채널 검색 다이얼로그 */}
      <CommandDialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <CommandInput placeholder="채널 검색..." value={searchQuery} onValueChange={setSearchQuery} />
        <CommandList>
          <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
          <CommandGroup heading="채널">
            {filteredChannels.map(channel => (
              <CommandItem
                key={channel.id}
                onSelect={() => {
                  setSelectedChannel(channel);
                  setIsSearchOpen(false);
                  setSearchQuery("");
                }}
              >
                <Hash className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span>{channel.name}</span>
                  {channel.description && (
                    <span className="text-sm text-gray-500">{channel.description}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* 채널 설정 다이얼로그 */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingChannel ? "채널 설정 수정" : "새 채널 만들기"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Input
                placeholder="채널 이름을 입력하세요"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
              />
              <Input
                placeholder="채널 설명 (선택사항)"
                value={newChannelDescription}
                onChange={(e) => setNewChannelDescription(e.target.value)}
              />
            </div>
            <Button 
              onClick={editingChannel ? handleUpdateChannel : handleAddChannel} 
              className="w-full"
            >
              {editingChannel ? "설정 저장" : "채널 만들기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 메인 채팅 영역 */}
      <div className="flex-1 flex flex-col bg-white">
        {/* 채널 헤더 */}
        <div className="h-14 border-b flex items-center justify-between px-4">
          <div className="flex items-center">
            <Hash className="h-5 w-5 text-gray-500 mr-2" />
            <div>
              <span className="font-semibold">{selectedChannel.name}</span>
              {selectedChannel.description && (
                <p className="text-sm text-gray-500">{selectedChannel.description}</p>
              )}
            </div>
          </div>
          
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Users className="h-4 w-4" />
                {selectedChannel.participants.length}
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">채널 참여자</h4>
                <div className="grid gap-2">
                  {selectedChannel.participants.map(user => (
                    <div key={user.id} className="flex items-center gap-2">
                      <Avatar>
                        <AvatarFallback style={{ backgroundColor: user.color }}>
                          {user.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        {user.name}
                        {user.id === currentUser.id && " (나)"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>

        {/* 메시지 영역 */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messagesByChannel[selectedChannel.id]?.map((msg) => (
              <div key={msg.id} className="group flex items-start gap-3">
                <Avatar>
                  <AvatarFallback style={{ backgroundColor: "purple" }}>
                    {msg.sender.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{msg.sender}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-900">{msg.text}</p>
                  
                  {/* 이모지 반응 */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {msg.reactions.map(reaction => (
                        <button
                          key={reaction.emoji}
                          className={`inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-full border ${
                            reaction.users.includes(currentUser.id)
                              ? "bg-purple-100 border-purple-200"
                              : "bg-gray-50 border-gray-200"
                          } hover:bg-purple-50 transition-colors`}
                          onClick={() => handleAddReaction(msg.id, reaction.emoji)}
                        >
                          <span>{reaction.emoji}</span>
                          <span className="text-xs text-gray-500">
                            {reaction.users.length}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 이모지 추가 버튼 */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Smile className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2">
                    <div className="flex gap-1">
                      {EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          className="hover:bg-gray-100 p-2 rounded"
                          onClick={() => handleAddReaction(msg.id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* 메시지 입력 영역 */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`${selectedChannel.name}에 메시지 보내기`}
              className="flex-1"
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            />
            <Button onClick={handleSendMessage}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
