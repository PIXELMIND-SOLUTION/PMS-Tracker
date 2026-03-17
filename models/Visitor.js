const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema({
  ip: { type: String, index: true },
  browser: { type: String, index: true },
  os: { type: String, index: true },
  device: { type: String, index: true },
  country: { type: String, index: true },
  city: String,
  page: { type: String, index: true },
  referrer: String,
  userAgent: String,
  sessionId: String,
  visitDuration: Number,
  createdAt: { type: Date, default: Date.now, index: true }
});

// Compound indexes for common queries
visitorSchema.index({ createdAt: -1, country: 1 });
visitorSchema.index({ createdAt: -1, device: 1 });  
visitorSchema.index({ ip: 1, createdAt: -1 });     

module.exports = mongoose.model("Visitor", visitorSchema);