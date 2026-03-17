require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require('http');
const socketIo = require('socket.io');
const visitorRoutes = require("./routes/visitorRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const notificationRoutes = require("./routes/notificatioRoutes");
const dns = require('dns');

const app = express();

// ✅ Fix DNS issue (MongoDB Atlas SRV)
dns.setServers(['8.8.8.8', '8.8.4.4']);

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.set("trust proxy", true);

// Database Connection
const dbURI = process.env.MONGO_URI || "mongodb://localhost:27017/tracker";
mongoose.connect(dbURI)
  .then(() => console.log("MongoDB Connected..."))
  .catch(err => console.error("Connection Error:", err));

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Join admin room for real-time notifications
  socket.on('join-admin', () => {
    socket.join('admin-room');
    console.log('Admin joined room');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Routes
app.use("/api", visitorRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);

// Basic Health Check
app.get("/", (req, res) => res.send("API is running..."));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});