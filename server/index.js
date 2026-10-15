require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  interests: [String],
  location: String,
  photo: String,
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  target: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: String,
  status: { type: String, default: 'open' },
}, { timestamps: true });
const Report = mongoose.model('Report', reportSchema);

app.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'Email already used' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });
  const token = jwt.sign({ id: user._id }, JWT_SECRET);
  res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user._id }, JWT_SECRET);
  res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
});

app.get('/users/me', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id).select('-passwordHash');
    res.json(user);
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.put('/users/me', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const { name, interests, location, photo } = req.body;
    const user = await User.findByIdAndUpdate(payload.id, { name, interests, location, photo }, { new: true }).select('-passwordHash');
    res.json(user);
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.get('/users', async (req, res) => {
  const { interest, location } = req.query;
  const filter = {};
  if (interest) filter.interests = interest;
  if (location) filter.location = location;
  const users = await User.find(filter).select('-passwordHash');
  res.json(users);
});

app.post('/reports', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const { target, reason } = req.body;
    const report = await Report.create({ reporter: payload.id, target, reason });
    res.json(report);
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.get('/reports', async (req, res) => {
  const reports = await Report.find().populate('reporter target', 'name email');
  res.json(reports);
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const waitingQueue = [];

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.userId = payload.id;
    next();
  } catch (e) {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  socket.on('find-random', () => {
    if (waitingQueue.length > 0) {
      const other = waitingQueue.shift();
      const roomId = `room-${socket.id}-${other.id}`;
      socket.join(roomId);
      other.join(roomId);
      socket.emit('matched', { roomId, partnerId: other.userId });
      other.emit('matched', { roomId, partnerId: socket.userId });
      socket.currentRoom = roomId;
      other.currentRoom = roomId;
    } else {
      waitingQueue.push(socket);
      socket.emit('waiting');
    }
  });

  socket.on('message', (data) => {
    const { roomId, content } = data;
    if (!roomId || !content) return;
    const msg = { from: socket.userId, content, createdAt: new Date() };
    io.to(roomId).emit('message', msg);
  });

  socket.on('webrtc-offer', ({ roomId, offer, to }) => {
    socket.to(roomId).emit('webrtc-offer', { offer, from: socket.userId });
  });
  socket.on('webrtc-answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('webrtc-answer', { answer, from: socket.userId });
  });
  socket.on('webrtc-ice', ({ roomId, candidate }) => {
    socket.to(roomId).emit('webrtc-ice', { candidate, from: socket.userId });
  });
  socket.on('hangup', ({ roomId }) => {
    socket.to(roomId).emit('hangup');
  });

  socket.on('disconnect', () => {
    const idx = waitingQueue.indexOf(socket);
    if (idx !== -1) waitingQueue.splice(idx, 1);
  });
});

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGODB_URI;

mongoose.connect(MONGO_URI).then(() => {
  if (require.main === module) {
  server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
}
module.exports = app;
}).catch((err) => {
  console.error('Mongo connection failed:', err.message);
  server.listen(PORT, () => console.log(`Server listening (no db) on ${PORT}`));
});