require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const waitingQueue = [];

io.use((socket, next) => {
  const auth = socket.handshake.auth || {};
  const name = String(auth.name || '').trim().slice(0, 30);
  if (!name) return next(new Error('Name is required'));
  socket.userId = `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  socket.userName = name;
  socket.userGender = auth.gender === 'Femelle' ? 'Femelle' : 'Mâle';
  next();
});

io.on('connection', (socket) => {
  socket.on('find-random', () => {
    if (socket.currentRoom) {
      socket.leave(socket.currentRoom);
      socket.to(socket.currentRoom).emit('partner-left');
      socket.currentRoom = null;
    }
    if (waitingQueue.length > 0) {
      const other = waitingQueue.shift();
      const roomId = `room-${socket.id}-${other.id}`;
      socket.join(roomId);
      other.join(roomId);
      socket.emit('matched', { roomId, partnerId: other.userId, partnerName: other.userName, partnerGender: other.userGender });
      other.emit('matched', { roomId, partnerId: socket.userId, partnerName: socket.userName, partnerGender: socket.userGender });
      socket.currentRoom = roomId;
      other.currentRoom = roomId;
    } else {
      if (!waitingQueue.includes(socket)) waitingQueue.push(socket);
      socket.emit('waiting');
    }
  });

  socket.on('next', () => {
    if (socket.currentRoom) {
      socket.leave(socket.currentRoom);
      socket.to(socket.currentRoom).emit('partner-left');
      socket.currentRoom = null;
    }
    const idx = waitingQueue.indexOf(socket);
    if (idx !== -1) waitingQueue.splice(idx, 1);
    socket.emit('searching');
    const other = waitingQueue.shift();
    if (other && other.id !== socket.id) {
      const roomId = `room-${socket.id}-${other.id}`;
      socket.join(roomId);
      other.join(roomId);
      socket.emit('matched', { roomId, partnerId: other.userId, partnerName: other.userName, partnerGender: other.userGender });
      other.emit('matched', { roomId, partnerId: socket.userId, partnerName: socket.userName, partnerGender: socket.userGender });
      socket.currentRoom = roomId;
      other.currentRoom = roomId;
    } else {
      waitingQueue.push(socket);
      socket.emit('waiting');
    }
  });

  socket.on('message', ({ roomId, content }) => {
    if (!roomId || !content) return;
    io.to(roomId).emit('message', { from: socket.userName, content, createdAt: new Date() });
  });

  socket.on('webrtc-offer', ({ roomId, offer }) => socket.to(roomId).emit('webrtc-offer', { offer, from: socket.userId }));
  socket.on('webrtc-answer', ({ roomId, answer }) => socket.to(roomId).emit('webrtc-answer', { answer, from: socket.userId }));
  socket.on('webrtc-ice', ({ roomId, candidate }) => socket.to(roomId).emit('webrtc-ice', { candidate, from: socket.userId }));
  socket.on('hangup', ({ roomId }) => socket.to(roomId).emit('hangup'));

  socket.on('disconnect', () => {
    const idx = waitingQueue.indexOf(socket);
    if (idx !== -1) waitingQueue.splice(idx, 1);
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('partner-left');
      socket.currentRoom = null;
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));