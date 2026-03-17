require('dotenv').config(); // Load variables from .env file
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const visitorRoutes = require("./routes/visitorRoutes");
const dns = require('dns');


const app = express();

// ✅ Fix DNS issue (MongoDB Atlas SRV)
dns.setServers(['8.8.8.8', '8.8.4.4']);

// Middleware
app.use(cors());
app.use(express.json());
app.set("trust proxy", true); // Essential for accurate req.ip

// Database Connection
const dbURI = process.env.MONGO_URI || "mongodb://localhost:27017/tracker";
mongoose.connect(dbURI)
    .then(() => console.log("MongoDB Connected..."))
    .catch(err => console.error("Connection Error:", err));

// Routes
app.use("/api", visitorRoutes);

// Basic Health Check
app.get("/", (req, res) => res.send("API is running..."));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});