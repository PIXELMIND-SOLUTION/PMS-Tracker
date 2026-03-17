const express = require("express");
const router = express.Router();
const Visitor = require("../models/Visitor");
const UAParser = require("ua-parser-js");
const axios = require("axios");

// 🔹 Track Visitor
router.post("/track", async (req, res) => {
  try {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

    const parser = new UAParser(req.headers["user-agent"]);
    const ua = parser.getResult();

    let location = {};
    try {
      const response = await axios.get(`https://ipapi.co/${ip}/json/`);
      location = response.data;
    } catch (err) {
      console.log("Location error");
    }

    const visitor = new Visitor({
      ip,
      browser: ua.browser.name,
      os: ua.os.name,
      device: ua.device.type || "desktop",
      country: location.country_name,
      city: location.city,
      page: req.body.page,
    });

    await visitor.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Get Visitors
router.get("/visitors", async (req, res) => {
  const data = await Visitor.find().sort({ createdAt: -1 });
  res.json(data);
});

// 🔹 Get IP Details (for modal)
router.get("/ip-details/:ip", async (req, res) => {
  try {
    const response = await axios.get(
      `https://ipapi.co/${req.params.ip}/json/`
    );
    res.json(response.data);
  } catch {
    res.status(500).json({ error: "Failed to fetch IP details" });
  }
});

module.exports = router;