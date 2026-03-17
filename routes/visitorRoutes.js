const express = require("express");
const router = express.Router();
const Visitor = require("../models/Visitor");
const UAParser = require("ua-parser-js");
const axios = require("axios");

// ==================== TRACKING APIs ====================

// 🔹 Track Visitor (POST)
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

        // Emit socket event for real-time notification
        const io = req.app.get('io');
        io.to('admin-room').emit('new-visitor', {
            message: 'New visitor tracked',
            visitor: {
                ...visitor.toObject(),
                timeAgo: 'Just now'
            }
        });

        res.json({ success: true, visitor });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== BASIC GET APIs ====================

// 1. Get all visitors (with pagination)
router.get("/visitors", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const data = await Visitor.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Visitor.countDocuments();

        res.json({
            data,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: limit
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// 3. Get visitors by IP address
router.get("/visitors/ip/:ip", async (req, res) => {
    try {
        const data = await Visitor.find({ ip: req.params.ip })
            .sort({ createdAt: -1 });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Get visitors by country
router.get("/visitors/country/:country", async (req, res) => {
    try {
        const data = await Visitor.find({ 
            country: new RegExp(req.params.country, 'i') 
        }).sort({ createdAt: -1 });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Get visitors by city
router.get("/visitors/city/:city", async (req, res) => {
    try {
        const data = await Visitor.find({ 
            city: new RegExp(req.params.city, 'i') 
        }).sort({ createdAt: -1 });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Get visitors by browser
router.get("/visitors/browser/:browser", async (req, res) => {
    try {
        const data = await Visitor.find({ 
            browser: new RegExp(req.params.browser, 'i') 
        }).sort({ createdAt: -1 });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Get visitors by OS
router.get("/visitors/os/:os", async (req, res) => {
    try {
        const data = await Visitor.find({ 
            os: new RegExp(req.params.os, 'i') 
        }).sort({ createdAt: -1 });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Get visitors by device type
router.get("/visitors/device/:device", async (req, res) => {
    try {
        const data = await Visitor.find({ device: req.params.device })
            .sort({ createdAt: -1 });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. Get visitors by page
router.get("/visitors/page", async (req, res) => {
    try {
        const { url, path } = req.query;
        let query = {};
        
        if (url) query.page = new RegExp(url, 'i');
        if (path) query.page = new RegExp(path, 'i');
        
        const data = await Visitor.find(query).sort({ createdAt: -1 });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10. Get visitors within date range
router.get("/visitors/date-range", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: "startDate and endDate are required" });
        }

        const data = await Visitor.find({
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        }).sort({ createdAt: -1 });
        
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 11. Get visitors by specific date
router.get("/visitors/date/:date", async (req, res) => {
    try {
        const date = new Date(req.params.date);
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);

        const data = await Visitor.find({
            createdAt: {
                $gte: date,
                $lt: nextDate
            }
        }).sort({ createdAt: -1 });
        
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 12. Get today's visitors
router.get("/visitors/today", async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const data = await Visitor.find({
            createdAt: {
                $gte: today,
                $lt: tomorrow
            }
        }).sort({ createdAt: -1 });
        
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 13. Get yesterday's visitors
router.get("/visitors/yesterday", async (req, res) => {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const data = await Visitor.find({
            createdAt: {
                $gte: yesterday,
                $lt: today
            }
        }).sort({ createdAt: -1 });
        
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 14. Get this week's visitors
router.get("/visitors/this-week", async (req, res) => {
    try {
        const today = new Date();
        const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
        firstDay.setHours(0, 0, 0, 0);
        
        const lastDay = new Date(firstDay);
        lastDay.setDate(lastDay.getDate() + 7);

        const data = await Visitor.find({
            createdAt: {
                $gte: firstDay,
                $lt: lastDay
            }
        }).sort({ createdAt: -1 });
        
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 15. Get this month's visitors
router.get("/visitors/this-month", async (req, res) => {
    try {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const data = await Visitor.find({
            createdAt: {
                $gte: firstDay,
                $lte: lastDay
            }
        }).sort({ createdAt: -1 });
        
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== AGGREGATION APIs ====================

// 16. Get visitor count (total)
router.get("/visitors/count/total", async (req, res) => {
    try {
        const count = await Visitor.countDocuments();
        res.json({ total: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 17. Get unique visitor count (by IP)
router.get("/visitors/count/unique", async (req, res) => {
    try {
        const uniqueIPs = await Visitor.distinct('ip');
        res.json({ unique: uniqueIPs.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 18. Get visitors by country (aggregated)
router.get("/visitors/analytics/by-country", async (req, res) => {
    try {
        const data = await Visitor.aggregate([
            { $group: { 
                _id: "$country", 
                count: { $sum: 1 },
                uniqueIPs: { $addToSet: "$ip" }
            }},
            { $project: {
                country: "$_id",
                count: 1,
                uniqueVisitors: { $size: "$uniqueIPs" }
            }},
            { $sort: { count: -1 } }
        ]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 19. Get visitors by device type (aggregated)
router.get("/visitors/analytics/by-device", async (req, res) => {
    try {
        const data = await Visitor.aggregate([
            { $group: { 
                _id: "$device", 
                count: { $sum: 1 } 
            }},
            { $project: {
                device: "$_id",
                count: 1
            }}
        ]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 20. Get visitors by browser (aggregated)
router.get("/visitors/analytics/by-browser", async (req, res) => {
    try {
        const data = await Visitor.aggregate([
            { $group: { 
                _id: "$browser", 
                count: { $sum: 1 } 
            }},
            { $project: {
                browser: "$_id",
                count: 1
            }},
            { $sort: { count: -1 } }
        ]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 21. Get visitors by OS (aggregated)
router.get("/visitors/analytics/by-os", async (req, res) => {
    try {
        const data = await Visitor.aggregate([
            { $group: { 
                _id: "$os", 
                count: { $sum: 1 } 
            }},
            { $project: {
                os: "$_id",
                count: 1
            }},
            { $sort: { count: -1 } }
        ]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 22. Get hourly traffic
router.get("/visitors/analytics/hourly", async (req, res) => {
    try {
        const data = await Visitor.aggregate([
            {
                $group: {
                    _id: { $hour: "$createdAt" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } },
            {
                $project: {
                    hour: "$_id",
                    count: 1,
                    _id: 0
                }
            }
        ]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 23. Get daily traffic for last N days
router.get("/visitors/analytics/daily", async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const data = await Visitor.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        day: { $dayOfMonth: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
            {
                $project: {
                    date: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: {
                                $dateFromParts: {
                                    year: "$_id.year",
                                    month: "$_id.month",
                                    day: "$_id.day"
                                }
                            }
                        }
                    },
                    count: 1,
                    _id: 0
                }
            }
        ]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 24. Get top pages
router.get("/visitors/analytics/top-pages", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const data = await Visitor.aggregate([
            { $group: { 
                _id: "$page", 
                visits: { $sum: 1 },
                uniqueVisitors: { $addToSet: "$ip" }
            }},
            { $project: {
                page: "$_id",
                visits: 1,
                uniqueVisitors: { $size: "$uniqueVisitors" }
            }},
            { $sort: { visits: -1 } },
            { $limit: limit }
        ]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 25. Get recent visitors (with limit)
router.get("/visitors/recent", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const data = await Visitor.find()
            .sort({ createdAt: -1 })
            .limit(limit);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== SEARCH APIs ====================

// 26. Search visitors
router.get("/visitors/search", async (req, res) => {
    try {
        const { q, field } = req.query;
        
        if (!q) {
            return res.status(400).json({ error: "Search query required" });
        }

        let query = {};
        
        if (field) {
            // Search in specific field
            query[field] = new RegExp(q, 'i');
        } else {
            // Search in multiple fields
            query = {
                $or: [
                    { ip: new RegExp(q, 'i') },
                    { browser: new RegExp(q, 'i') },
                    { os: new RegExp(q, 'i') },
                    { device: new RegExp(q, 'i') },
                    { country: new RegExp(q, 'i') },
                    { city: new RegExp(q, 'i') },
                    { page: new RegExp(q, 'i') }
                ]
            };
        }

        const data = await Visitor.find(query)
            .sort({ createdAt: -1 })
            .limit(100);
        
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 27. Get IP details (external API)
router.get("/ip-details/:ip", async (req, res) => {
    try {
        const ip = req.params.ip;
        const response = await axios.get(
            `https://ipwho.is/${ip}`,
            { timeout: 5000 }
        );

        if (!response.data.success) {
            return res.status(400).json({
                error: true,
                message: "Invalid or private IP",
            });
        }

        res.json(response.data);
    } catch (err) {
        console.error("IP FETCH ERROR:", err.message);
        res.status(500).json({
            error: true,
            message: "External API failed",
        });
    }
});

// 2. Get visitor by ID
router.get("/visitors/:id", async (req, res) => {
    try {
        const visitor = await Visitor.findById(req.params.id);
        if (!visitor) return res.status(404).json({ error: "Visitor not found" });
        res.json(visitor);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;