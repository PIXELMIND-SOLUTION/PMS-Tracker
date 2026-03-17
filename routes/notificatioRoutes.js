const express = require("express");
const router = express.Router();
const Visitor = require("../models/Visitor");

// In-memory notification storage (use Redis in production)
let notifications = [];
let notificationId = 1;

// Get all notifications
router.get("/", async (req, res) => {
    try {
        const { limit = 50, unreadOnly = false } = req.query;
        
        let filteredNotifications = [...notifications];
        
        if (unreadOnly === 'true') {
            filteredNotifications = filteredNotifications.filter(n => !n.read);
        }
        
        filteredNotifications = filteredNotifications
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, parseInt(limit));
        
        res.json({
            success: true,
            notifications: filteredNotifications,
            unreadCount: notifications.filter(n => !n.read).length,
            total: notifications.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get unread count
router.get("/unread-count", async (req, res) => {
    try {
        const count = notifications.filter(n => !n.read).length;
        res.json({ unreadCount: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark notification as read
router.put("/:id/read", async (req, res) => {
    try {
        const notification = notifications.find(n => n.id === parseInt(req.params.id));
        
        if (notification) {
            notification.read = true;
            notification.readAt = new Date();
            
            // Emit update via socket
            const io = req.app.get('io');
            io.to('admin-room').emit('notification-updated', {
                id: notification.id,
                read: true
            });
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark all as read
router.put("/mark-all-read", async (req, res) => {
    try {
        notifications.forEach(n => {
            if (!n.read) {
                n.read = true;
                n.readAt = new Date();
            }
        });
        
        // Emit update via socket
        const io = req.app.get('io');
        io.to('admin-room').emit('all-notifications-read');
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete notification
router.delete("/:id", async (req, res) => {
    try {
        const index = notifications.findIndex(n => n.id === parseInt(req.params.id));
        
        if (index !== -1) {
            notifications.splice(index, 1);
            
            // Emit deletion via socket
            const io = req.app.get('io');
            io.to('admin-room').emit('notification-deleted', {
                id: parseInt(req.params.id)
            });
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clear all notifications
router.delete("/clear-all", async (req, res) => {
    try {
        notifications = [];
        notificationId = 1;
        
        // Emit clear all via socket
        const io = req.app.get('io');
        io.to('admin-room').emit('all-notifications-cleared');
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get notification settings
router.get("/settings", async (req, res) => {
    try {
        // You can store these in database
        const settings = {
            realtimeAlerts: true,
            emailNotifications: true,
            desktopNotifications: true,
            soundEnabled: true,
            alertThreshold: 10,
            notifyOn: {
                newVisitor: true,
                highTraffic: true,
                newCountry: true,
                newDevice: true
            }
        };
        
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update notification settings
router.put("/settings", async (req, res) => {
    try {
        // Save settings to database
        const settings = req.body;
        
        // Emit settings update
        const io = req.app.get('io');
        io.to('admin-room').emit('settings-updated', settings);
        
        res.json({ success: true, settings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Socket.IO event handlers (to be called from other routes)
function createNotification(io, type, data) {
    const notification = {
        id: notificationId++,
        type,
        data,
        timestamp: new Date(),
        read: false,
        message: getNotificationMessage(type, data)
    };
    
    notifications.push(notification);
    
    // Keep only last 100 notifications
    if (notifications.length > 100) {
        notifications = notifications.slice(-100);
    }
    
    // Emit to admin room
    io.to('admin-room').emit('new-notification', notification);
    
    // Emit unread count update
    io.to('admin-room').emit('unread-count-update', {
        count: notifications.filter(n => !n.read).length
    });
    
    return notification;
}

function getNotificationMessage(type, data) {
    switch(type) {
        case 'new-visitor':
            return `New visitor from ${data.country || 'Unknown location'}`;
        case 'high-traffic':
            return `High traffic detected: ${data.count} visitors in last 5 minutes`;
        case 'new-country':
            return `First visitor from ${data.country}`;
        case 'new-device':
            return `New device type detected: ${data.device}`;
        case 'visitor-milestone':
            return `Milestone reached: ${data.count} total visitors`;
        case 'system-alert':
            return `System alert: ${data.message}`;
        default:
            return 'New notification';
    }
}

// Export for use in other routes
module.exports = router;
module.exports.createNotification = createNotification;