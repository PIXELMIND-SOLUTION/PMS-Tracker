const express = require("express");
const router = express.Router();
const Visitor = require("../models/Visitor");

// Get complete dashboard data
router.get("/summary", async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        
        const lastMonth = new Date(today);
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        // Parallel queries for better performance
        const [
            totalVisitors,
            uniqueVisitors,
            todayVisitors,
            yesterdayVisitors,
            weeklyVisitors,
            monthlyVisitors,
            countryData,
            deviceData,
            browserData,
            osData,
            hourlyData,
            topPages,
            recentVisitors
        ] = await Promise.all([
            Visitor.countDocuments(),
            Visitor.distinct('ip').then(ips => ips.length),
            Visitor.countDocuments({ createdAt: { $gte: today } }),
            Visitor.countDocuments({ 
                createdAt: { 
                    $gte: yesterday, 
                    $lt: today 
                } 
            }),
            Visitor.countDocuments({ createdAt: { $gte: lastWeek } }),
            Visitor.countDocuments({ createdAt: { $gte: lastMonth } }),
            
            // Country distribution
            Visitor.aggregate([
                { $group: { _id: "$country", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            
            // Device distribution
            Visitor.aggregate([
                { $group: { _id: "$device", count: { $sum: 1 } } }
            ]),
            
            // Browser distribution
            Visitor.aggregate([
                { $group: { _id: "$browser", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            
            // OS distribution
            Visitor.aggregate([
                { $group: { _id: "$os", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            
            // Hourly traffic (last 24 hours)
            Visitor.aggregate([
                { 
                    $match: { 
                        createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) } 
                    } 
                },
                {
                    $group: {
                        _id: { $hour: "$createdAt" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id": 1 } }
            ]),
            
            // Top pages
            Visitor.aggregate([
                { $group: { 
                    _id: "$page", 
                    visits: { $sum: 1 },
                    uniqueIPs: { $addToSet: "$ip" }
                }},
                { $project: {
                    page: "$_id",
                    visits: 1,
                    uniqueVisitors: { $size: "$uniqueIPs" }
                }},
                { $sort: { visits: -1 } },
                { $limit: 10 }
            ]),
            
            // Recent visitors
            Visitor.find()
                .sort({ createdAt: -1 })
                .limit(20)
        ]);

        // Calculate growth percentages
        const dailyGrowth = yesterdayVisitors > 0 
            ? ((todayVisitors - yesterdayVisitors) / yesterdayVisitors * 100).toFixed(1)
            : 100;

        const weeklyAverage = weeklyVisitors / 7;
        const monthlyAverage = monthlyVisitors / 30;
        
        const weeklyGrowth = monthlyAverage > 0
            ? ((weeklyAverage - monthlyAverage) / monthlyAverage * 100).toFixed(1)
            : 0;

        res.json({
            overview: {
                totalVisitors,
                uniqueVisitors,
                todayVisitors,
                yesterdayVisitors,
                weeklyVisitors,
                monthlyVisitors,
                dailyGrowth: parseFloat(dailyGrowth),
                weeklyGrowth: parseFloat(weeklyGrowth),
                averageDaily: Math.round(weeklyAverage)
            },
            charts: {
                countries: countryData.map(item => ({
                    country: item._id || 'Unknown',
                    count: item.count
                })),
                devices: deviceData.map(item => ({
                    device: item._id || 'Unknown',
                    count: item.count
                })),
                browsers: browserData.map(item => ({
                    browser: item._id || 'Unknown',
                    count: item.count
                })),
                os: osData.map(item => ({
                    os: item._id || 'Unknown',
                    count: item.count
                })),
                hourly: hourlyData.map(item => ({
                    hour: item._id,
                    count: item.count
                }))
            },
            topPages: topPages.map(page => ({
                ...page,
                page: page.page || 'Unknown'
            })),
            recentVisitors: recentVisitors.map(v => ({
                id: v._id,
                ip: v.ip,
                browser: v.browser,
                os: v.os,
                device: v.device,
                country: v.country,
                city: v.city,
                page: v.page,
                time: v.createdAt,
                timeAgo: getTimeAgo(v.createdAt)
            }))
        });
    } catch (err) {
        console.error("Dashboard Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get real-time stats (for live dashboard)
router.get("/realtime", async (req, res) => {
    try {
        const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
        const lastHour = new Date(Date.now() - 60 * 60 * 1000);

        const [
            activeNow,
            lastHourVisitors,
            pageViews5Min,
            uniqueIPs5Min
        ] = await Promise.all([
            // Visitors in last 5 minutes
            Visitor.countDocuments({ createdAt: { $gte: last5Minutes } }),
            
            // Visitors in last hour
            Visitor.countDocuments({ createdAt: { $gte: lastHour } }),
            
            // Page views in last 5 minutes
            Visitor.aggregate([
                { $match: { createdAt: { $gte: last5Minutes } } },
                { $group: { _id: "$page", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            
            // Unique IPs in last 5 minutes
            Visitor.distinct('ip', { createdAt: { $gte: last5Minutes } })
                .then(ips => ips.length)
        ]);

        res.json({
            timestamp: new Date(),
            stats: {
                activeNow,
                lastHourVisitors,
                uniqueIPs5Min,
                pageViews5Min: pageViews5Min.map(item => ({
                    page: item._id,
                    views: item.count
                }))
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get time-based analytics
router.get("/analytics/:period", async (req, res) => {
    try {
        const { period } = req.params;
        const { page } = req.query;
        
        let startDate = new Date();
        let groupBy;
        
        switch(period) {
            case 'hourly':
                startDate.setHours(startDate.getHours() - 24);
                groupBy = { $hour: "$createdAt" };
                break;
            case 'daily':
                startDate.setDate(startDate.getDate() - 30);
                groupBy = { 
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" },
                    day: { $dayOfMonth: "$createdAt" }
                };
                break;
            case 'weekly':
                startDate.setDate(startDate.getDate() - 90);
                groupBy = { 
                    year: { $year: "$createdAt" },
                    week: { $week: "$createdAt" }
                };
                break;
            case 'monthly':
                startDate.setMonth(startDate.getMonth() - 12);
                groupBy = { 
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" }
                };
                break;
            default:
                return res.status(400).json({ error: "Invalid period" });
        }

        let match = { createdAt: { $gte: startDate } };
        if (page) {
            match.page = new RegExp(page, 'i');
        }

        const data = await Visitor.aggregate([
            { $match: match },
            {
                $group: {
                    _id: groupBy,
                    visitors: { $sum: 1 },
                    uniqueIPs: { $addToSet: "$ip" }
                }
            },
            { $sort: { "_id": 1 } },
            {
                $project: {
                    period: "$_id",
                    visitors: 1,
                    uniqueVisitors: { $size: "$uniqueIPs" },
                    _id: 0
                }
            }
        ]);

        res.json({ period, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get comparison data
router.get("/compare", async (req, res) => {
    try {
        const { start1, end1, start2, end2 } = req.query;
        
        if (!start1 || !end1 || !start2 || !end2) {
            return res.status(400).json({ error: "All date ranges required" });
        }

        const [period1, period2] = await Promise.all([
            Visitor.find({
                createdAt: {
                    $gte: new Date(start1),
                    $lte: new Date(end1)
                }
            }),
            Visitor.find({
                createdAt: {
                    $gte: new Date(start2),
                    $lte: new Date(end2)
                }
            })
        ]);

        const getStats = (visitors) => ({
            total: visitors.length,
            uniqueIPs: new Set(visitors.map(v => v.ip)).size,
            byCountry: visitors.reduce((acc, v) => {
                acc[v.country] = (acc[v.country] || 0) + 1;
                return acc;
            }, {}),
            byDevice: visitors.reduce((acc, v) => {
                acc[v.device] = (acc[v.device] || 0) + 1;
                return acc;
            }, {})
        });

        res.json({
            period1: getStats(period1),
            period2: getStats(period2),
            change: {
                total: period2.length - period1.length,
                percentage: period1.length > 0 
                    ? ((period2.length - period1.length) / period1.length * 100).toFixed(1)
                    : 100
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper function for time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60,
        second: 1
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }
    
    return 'Just now';
}

module.exports = router;