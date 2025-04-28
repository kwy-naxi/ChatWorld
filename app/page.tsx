"use client";

import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Plus, Hash, Settings, Trash2, Search, Users, Smile, X, Upload, File } from "lucide-react";
import { io, Socket } from "socket.io-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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

interface Message {
  id: string;
  text: string;
  sender: string;
  senderId: string;
  timestamp: number;
  channelId: string;
  edited?: boolean;
  reactions?: {
    emoji: string;
    users: string[];
  }[];
  file?: {
    name: string;
    path: string;
    size: number;
    type: string;
  };
}

interface MessageEventData {
  messageId: string;
  channelId: string;
  timestamp: number;
  newText?: string;
  reactions?: {
    emoji: string;
    users: string[];
  }[];
}

interface User {
  id: string;
  name: string;
  color: string;
}

interface Channel {
  id: string;
  name: string;
  description?: string;
  participants: User[];
}

const EMOJIS = ["👍", "❤️", "😄", "🎉", "🙏", "👀"];

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User>({
    id: crypto.randomUUID(),
    name: `사용자${Math.floor(Math.random() * 1000)}`,
    color: `hsl(${Math.random() * 360}, 70%, 50%)`
  });

  const [socket, setSocket] = useState<Socket | null>(null);
  const [message, setMessage] = useState("");
  const [channels, setChannels] = useState<Channel[]>([
    {
      id: "1",
      name: "일반",
      description: "일반 대화를 위한 채널입니다.",
      participants: []
    }
  ]);
  const [selectedChannel, setSelectedChannel] = useState<Channel>(channels[0]);
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, Message[]>>({});
  const [connectedUsers, setConnectedUsers] = useState<User[]>([currentUser]);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // 클라이언트 사이드에서만 localStorage 접근
  useEffect(() => {
    const savedUser = localStorage.getItem('chatUser');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    } else {
      const newUser = {
        id: crypto.randomUUID(),
        name: `사용자${Math.floor(Math.random() * 1000)}`,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`
      };
      localStorage.setItem('chatUser', JSON.stringify(newUser));
      setCurrentUser(newUser);
    }
  }, []);

  const handleSendMessage = () => {
    if (!message.trim() || !socket) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      text: message,
      sender: currentUser.name,
      senderId: currentUser.id,
      timestamp: Date.now(),
      channelId: selectedChannel.id
    };

    // 메시지를 즉시 화면에 표시
    setMessagesByChannel(prev => {
      const currentMessages = prev[selectedChannel.id] || [];
      const updatedMessages = [...currentMessages, newMessage];
      const newState = { ...prev };
      newState[selectedChannel.id] = updatedMessages;
      return newState;
    });

    // 서버로 메시지 전송
    socket.emit("send-message", newMessage);
    setMessage("");
  };

  useEffect(() => {
    const newSocket = io("http://localhost:3001");
    setSocket(newSocket);

    // 유저 정보 전송
    newSocket.emit("user-join", {
      id: currentUser.id,
      name: currentUser.name,
      color: currentUser.color
    });

    // 유저 목록 업데이트
    newSocket.on("user-list-update", (users: User[]) => {
      const updatedUsers = users.filter(user => user.id !== currentUser.id);
      setConnectedUsers([currentUser, ...updatedUsers]);
    });

    // 유저 입장 처리
    newSocket.on("user-connected", (data) => {
      const systemMessage = {
        id: crypto.randomUUID(),
        text: data.message,
        sender: "system",
        senderId: "system",
        timestamp: data.timestamp,
        channelId: selectedChannel.id
      };
      
      setMessagesByChannel(prev => {
        const currentMessages = prev[selectedChannel.id] || [];
        return {
          ...prev,
          [selectedChannel.id]: [...currentMessages, systemMessage]
        };
      });

      // 유저 목록 업데이트 (중복 방지)
      if (data.user && data.user.id !== currentUser.id) {
        setConnectedUsers(prev => {
          if (!prev.some(user => user.id === data.user.id)) {
            return [...prev, data.user];
          }
          return prev;
        });
      }
    });

    // 유저 퇴장 처리
    newSocket.on("user-disconnected", (data) => {
      const systemMessage = {
        id: crypto.randomUUID(),
        text: data.message,
        sender: "system",
        senderId: "system",
        timestamp: data.timestamp,
        channelId: selectedChannel.id
      };
      
      setMessagesByChannel(prev => {
        const currentMessages = prev[selectedChannel.id] || [];
        return {
          ...prev,
          [selectedChannel.id]: [...currentMessages, systemMessage]
        };
      });

      // 유저 목록에서 제거 (현재 사용자는 제외)
      if (data.userId !== currentUser.id) {
        setConnectedUsers(prev => prev.filter(user => user.id !== data.userId));
      }
    });

    // 메시지 수신 처리
    newSocket.on("receive-message", (message: Message) => {
      // 자신이 보낸 메시지는 이미 표시되어 있으므로 무시
      if (message.senderId === currentUser.id && !message.file) return;

      setMessagesByChannel(prev => {
        const currentMessages = prev[message.channelId] || [];
        if (currentMessages.some(m => m.id === message.id)) {
          return prev;
        }
        const updatedMessages = [...currentMessages, message];
        return {
          ...prev,
          [message.channelId]: updatedMessages
        };
      });
    });

    // 메시지 수정 이벤트 처리
    newSocket.on("message-edited", (data: MessageEventData) => {
      setMessagesByChannel(prev => {
        const currentMessages = prev[data.channelId] || [];
        const updatedMessages = currentMessages.map(msg => {
          if (msg.id === data.messageId) {
            return {
              ...msg,
              text: data.newText || msg.text,
              edited: true
            } as Message;
          }
          return msg;
        });
        return {
          ...prev,
          [data.channelId]: updatedMessages
        };
      });
    });

    // 메시지 삭제 이벤트 처리
    newSocket.on("message-deleted", (data: MessageEventData) => {
      setMessagesByChannel(prev => {
        const currentMessages = prev[data.channelId] || [];
        const updatedMessages = currentMessages.filter(msg => msg.id !== data.messageId);
        return {
          ...prev,
          [data.channelId]: updatedMessages
        };
      });
    });

    // 이모지 반응 업데이트 이벤트 처리
    newSocket.on("reaction-updated", (data: MessageEventData) => {
      setMessagesByChannel(prev => {
        const currentMessages = prev[data.channelId] || [];
        const updatedMessages = currentMessages.map(msg => {
          if (msg.id === data.messageId) {
            return {
              ...msg,
              reactions: data.reactions || []
            } as Message;
          }
          return msg;
        });
        return {
          ...prev,
          [data.channelId]: updatedMessages
        };
      });
    });

    return () => {
      newSocket.close();
    };
  }, [currentUser, selectedChannel.id]);

  const handleEditMessage = (messageId: string, newText: string) => {
    if (!socket) return;
    socket.emit("edit-message", {
      messageId,
      newText,
      senderId: currentUser.id,
      channelId: selectedChannel.id
    });
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!socket) return;
    socket.emit("delete-message", {
      messageId,
      senderId: currentUser.id,
      channelId: selectedChannel.id
    });
  };

  const handleToggleReaction = (messageId: string, emoji: string) => {
    if (!socket) return;
    socket.emit("toggle-reaction", {
      messageId,
      emoji,
      userId: currentUser.id,
      channelId: selectedChannel.id
    });
  };

  const handleAddChannel = () => {
    if (!newChannelName.trim()) return;

    const newChannel = {
      id: crypto.randomUUID(),
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('파일 크기는 10MB를 초과할 수 없습니다.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !socket) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setIsUploading(true);
      const response = await fetch('http://localhost:3001/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('파일 업로드에 실패했습니다.');
      }

      const fileInfo = await response.json();

      // 파일 공유 메시지 전송
      socket.emit("share-file", {
        text: `파일을 공유했습니다: ${fileInfo.name}`,
        sender: currentUser.name,
        senderId: currentUser.id,
        channelId: selectedChannel.id,
        file: fileInfo
      });

      setSelectedFile(null);
      setUploadProgress(0);
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      alert('파일 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    channel.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen">
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
                {connectedUsers.length}
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">접속 중인 사용자</h4>
                <div className="grid gap-2">
                  {connectedUsers.map(user => (
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
                  <AvatarFallback style={{ 
                    backgroundColor: msg.senderId === currentUser.id ? currentUser.color : "purple" 
                  }}>
                    {msg.sender.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {msg.sender}
                      {msg.senderId === currentUser.id && " (나)"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                      {msg.edited && " (수정됨)"}
                    </span>
                  </div>
                  <p className="text-gray-900">{msg.text}</p>
                  
                  {/* 이미지 표시 */}
                  {msg.file && (
                    <div className="mt-2 relative group">
                      {msg.file.type.startsWith('image/') ? (
                        <>
                          <img 
                            src={msg.file.path} 
                            alt={msg.file.name}
                            className="max-w-md rounded-lg border"
                          />
                          {msg.senderId === currentUser.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white"
                              onClick={() => {
                                if (confirm("이 이미지를 삭제하시겠습니까?")) {
                                  handleDeleteMessage(msg.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2 p-2 border rounded-lg">
                          <File className="h-4 w-4" />
                          <div>
                            <p className="text-sm font-medium">{msg.file.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(msg.file.size)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
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
                          onClick={() => handleToggleReaction(msg.id, reaction.emoji)}
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

                {/* 메시지 수정/삭제 버튼 */}
                {msg.senderId === currentUser.id && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2">
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => {
                              const newText = prompt("메시지를 수정하세요:", msg.text);
                              if (newText && newText !== msg.text) {
                                handleEditMessage(msg.id, newText);
                              }
                            }}
                          >
                            수정
                          </Button>
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-red-500"
                            onClick={() => {
                              if (confirm("메시지를 삭제하시겠습니까?")) {
                                handleDeleteMessage(msg.id);
                              }
                            }}
                          >
                            삭제
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

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
                          onClick={() => handleToggleReaction(msg.id, emoji)}
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
          <div className="flex flex-col gap-2">
            {selectedFile && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`${selectedChannel.name}에 메시지 보내기`}
                className="flex-1"
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <div className="flex gap-2">
                <Input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                <Button onClick={handleSendMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {selectedFile && (
              <Button
                onClick={handleFileUpload}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? '업로드 중...' : '파일 공유'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
