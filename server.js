const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// 연결된 사용자 관리
const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log(`사용자 연결됨: ${socket.id}`);
  
  // 임시 사용자 이름 생성
  const username = `사용자${Math.floor(Math.random() * 1000)}`;
  connectedUsers.set(socket.id, username);

  // 새 사용자 입장 알림
  io.emit("user-connected", {
    message: `${username}님이 입장하셨습니다.`,
    timestamp: Date.now()
  });

  // 메시지 수신 및 브로드캐스트
  socket.on("send-message", (message) => {
    const enhancedMessage = {
      ...message,
      sender: username,
      timestamp: Date.now()
    };
    io.emit("receive-message", enhancedMessage);
  });

  // 메시지 편집 이벤트 핸들러
  socket.on("edit-message", (data) => {
    io.emit("message-edited", {
      messageId: data.messageId,
      newText: data.newText,
      timestamp: Date.now()
    });
  });

  // 메시지 삭제 이벤트 핸들러
  socket.on("delete-message", (messageId) => {
    io.emit("message-deleted", {
      messageId,
      timestamp: Date.now()
    });
  });

  // 연결 해제 처리
  socket.on("disconnect", () => {
    const username = connectedUsers.get(socket.id);
    console.log(`사용자 연결 해제: ${username}`);
    
    io.emit("user-disconnected", {
      message: `${username}님이 퇴장하셨습니다.`,
      timestamp: Date.now()
    });
    
    connectedUsers.delete(socket.id);
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
}); 