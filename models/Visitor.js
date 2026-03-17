const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema({
  ip: String,
  browser: String,
  os: String,
  device: String,
  country: String,
  city: String,
  page: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Visitor", visitorSchema);