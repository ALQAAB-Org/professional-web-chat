const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// CORS setup
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// MongoDB Connection - YAHI USE KARENGE
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected Successfully!'))
.catch(err => console.log('❌ MongoDB Connection Error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  avatar: String,
  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  from: String,
  to: String,
  text: String,
  image: String,
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  type: { type: String, default: 'text' }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// Socket.io Connections
io.on('connection', (socket) => {
  console.log('🔗 User connected:', socket.id);

  // User login
  socket.on('user-login', async (userData) => {
    try {
      let user = await User.findOne({ email: userData.email });
      if (!user) {
        user = new User({
          email: userData.email,
          name: userData.name,
          avatar: userData.avatar,
          online: true,
          lastSeen: new Date()
        });
      } else {
        user.online = true;
        user.lastSeen = new Date();
        user.name = userData.name;
        user.avatar = userData.avatar;
      }
      await user.save();
      socket.userEmail = userData.email;
      
      const allUsers = await User.find({ email: { $ne: userData.email } });
      io.emit('online-users', allUsers);
      
      console.log(`✅ ${userData.name} logged in`);
    } catch (error) {
      console.log('❌ Login error:', error);
    }
  });

  // Send message
  socket.on('send-message', async (data) => {
    try {
      const message = new Message({
        from: data.from,
        to: data.to,
        text: data.text,
        image: data.image,
        read: false,
        type: data.type || 'text'
      });
      await message.save();
      
      const fromUser = await User.findOne({ email: data.from });
      const messageWithUser = {
        ...message.toObject(),
        user: fromUser
      };
      
      io.emit('new-message', messageWithUser);
      console.log(`💬 Message sent from ${data.from} to ${data.to}`);
    } catch (error) {
      console.log('❌ Message send error:', error);
    }
  });

  // Get chat history
  socket.on('get-chat-history', async (data) => {
    try {
      const messages = await Message.find({
        $or: [
          { from: data.user1, to: data.user2 },
          { from: data.user2, to: data.user1 }
        ]
      }).sort({ timestamp: 1 });
      
      socket.emit('chat-history', messages);
    } catch (error) {
      console.log('❌ Chat history error:', error);
    }
  });

  // User typing
  socket.on('typing', (data) => {
    socket.broadcast.emit('user-typing', {
      from: data.from,
      to: data.to,
      typing: true
    });
  });

  // Stop typing
  socket.on('stop-typing', (data) => {
    socket.broadcast.emit('user-typing', {
      from: data.from,
      to: data.to,
      typing: false
    });
  });

  // User disconnect
  socket.on('disconnect', async () => {
    if (socket.userEmail) {
      await User.findOneAndUpdate(
        { email: socket.userEmail },
        { 
          online: false, 
          lastSeen: new Date() 
        }
      );
      const onlineUsers = await User.find({ online: true });
      io.emit('online-users', onlineUsers);
      console.log(`🔴 ${socket.userEmail} disconnected`);
    }
  });
});

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Chat Server is running!',
    timestamp: new Date().toISOString()
  });
});

// Get all users API
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ online: -1, name: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready for connections`);
});
