const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use('/uploads', express.static('uploads'));

// 업로드 디렉토리 생성
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// 파일 저장 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('허용되지 않는 파일 형식입니다.'));
    }
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// 연결된 사용자 관리
const connectedUsers = new Map();
// 메시지 저장소
const messages = new Map();

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
      timestamp: Date.now(),
      reactions: [] // 이모지 반응을 위한 배열 추가
    };
    
    // 메시지 저장
    if (!messages.has(message.channelId)) {
      messages.set(message.channelId, []);
    }
    messages.get(message.channelId).push(enhancedMessage);
    
    io.emit("receive-message", enhancedMessage);
  });

  // 메시지 수정
  socket.on("edit-message", (data) => {
    const { messageId, newText, senderId, channelId } = data;
    const channelMessages = messages.get(channelId);
    
    if (channelMessages) {
      const messageIndex = channelMessages.findIndex(m => m.id === messageId);
      if (messageIndex !== -1 && channelMessages[messageIndex].senderId === senderId) {
        channelMessages[messageIndex].text = newText;
        channelMessages[messageIndex].edited = true;
        
        io.emit("message-edited", {
          messageId,
          newText,
          channelId,
          timestamp: Date.now()
        });
      }
    }
  });

  // 메시지 삭제
  socket.on("delete-message", (data) => {
    const { messageId, senderId, channelId } = data;
    const channelMessages = messages.get(channelId);
    
    if (channelMessages) {
      const messageIndex = channelMessages.findIndex(m => m.id === messageId);
      if (messageIndex !== -1 && channelMessages[messageIndex].senderId === senderId) {
        // 이미지 파일이 있는 경우 삭제
        const message = channelMessages[messageIndex];
        if (message.file && message.file.path) {
          const filePath = path.join(__dirname, message.file.path);
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error('파일 삭제 실패:', err);
            }
          });
        }
        
        channelMessages.splice(messageIndex, 1);
        
        io.emit("message-deleted", {
          messageId,
          channelId,
          timestamp: Date.now()
        });
      }
    }
  });

  // 이모지 반응 추가/제거
  socket.on("toggle-reaction", (data) => {
    const { messageId, emoji, userId, channelId } = data;
    const channelMessages = messages.get(channelId);
    
    if (channelMessages) {
      const message = channelMessages.find(m => m.id === messageId);
      if (message) {
        const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);
        
        if (reactionIndex === -1) {
          // 새로운 반응 추가
          message.reactions.push({
            emoji,
            users: [userId]
          });
        } else {
          // 기존 반응에서 사용자 추가/제거
          const userIndex = message.reactions[reactionIndex].users.indexOf(userId);
          if (userIndex === -1) {
            message.reactions[reactionIndex].users.push(userId);
          } else {
            message.reactions[reactionIndex].users.splice(userIndex, 1);
            if (message.reactions[reactionIndex].users.length === 0) {
              message.reactions.splice(reactionIndex, 1);
            }
          }
        }
        
        io.emit("reaction-updated", {
          messageId,
          channelId,
          reactions: message.reactions,
          timestamp: Date.now()
        });
      }
    }
  });

  // 파일 공유 메시지 처리
  socket.on("share-file", (data) => {
    const message = {
      id: crypto.randomUUID(),
      text: data.text || '',
      sender: data.sender,
      senderId: data.senderId,
      timestamp: Date.now(),
      channelId: data.channelId,
      file: data.file
    };
    
    io.emit("receive-message", message);
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

// 파일 업로드 엔드포인트
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
  }
  
  const fileInfo = {
    name: req.file.originalname,
    path: `/uploads/${req.file.filename}`,
    size: req.file.size,
    type: req.file.mimetype
  };
  
  res.json(fileInfo);
});

// 파일 삭제 엔드포인트
app.delete('/file/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  
  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(500).json({ error: '파일 삭제에 실패했습니다.' });
    }
    res.json({ message: '파일이 삭제되었습니다.' });
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
}); 