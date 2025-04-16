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
  console.log("User connected:", socket.id);

  // 유저 연결 시 정보 저장
  socket.on("user-join", (userData) => {
    const userInfo = {
      id: userData.id,
      name: userData.name,
      color: userData.color
    };
    
    connectedUsers.set(userData.id, userInfo);
    
    // 입장 메시지와 유저 목록을 함께 전송
    io.emit("user-connected", {
      message: `${userData.name}님이 입장하셨습니다.`,
      timestamp: Date.now(),
      user: userInfo
    });
    
    // 모든 클라이언트에게 유저 목록 업데이트
    io.emit("user-list-update", Array.from(connectedUsers.values()));
  });

  // 메시지 전송
  socket.on("send-message", (message) => {
    // 메시지에 발신자 정보 추가
    const userInfo = connectedUsers.get(message.senderId);
    const enhancedMessage = {
      ...message,
      timestamp: Date.now()
    };
    io.emit("receive-message", enhancedMessage);
  });

  // 메시지 수정
  socket.on("edit-message", (data) => {
    const userInfo = connectedUsers.get(data.senderId);
    io.emit("message-edited", {
      ...data,
      timestamp: Date.now()
    });
  });

  // 메시지 삭제
  socket.on("delete-message", (data) => {
    const userInfo = connectedUsers.get(data.senderId);
    io.emit("message-deleted", {
      ...data,
      timestamp: Date.now()
    });
  });

  // 연결 해제 시
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    
    // 연결 해제된 사용자 찾기
    let disconnectedUser = null;
    for (const [userId, userInfo] of connectedUsers.entries()) {
      if (userInfo.id === socket.id) {
        disconnectedUser = userInfo;
        break;
      }
    }

    if (disconnectedUser) {
      io.emit("user-disconnected", {
        message: `${disconnectedUser.name}님이 퇴장하셨습니다.`,
        timestamp: Date.now(),
        userId: disconnectedUser.id
      });
      connectedUsers.delete(disconnectedUser.id);
      io.emit("user-list-update", Array.from(connectedUsers.values()));
    }
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
}); 