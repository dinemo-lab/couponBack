// server.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.ORIGIN||'*',
  credentials: true
}));

// Available coupons
const coupons = [
  "SPRING25", "SUMMER20", "FALL30", "WINTER15", 
  "WELCOME10", "SPECIAL50", "DISCOUNT40", "SAVE35",
  "DEAL20", "EXTRA15", "BONUS25", "FLASH30"
];

let currentCouponIndex = 0;
const restrictionTime = 3600; // 1 hour in seconds
const ipRestrictions = {}; // Store IP restrictions
const COOKIE_NAME = 'coupon_claim_data';

// Helper to check if IP is restricted
const isRestricted = (ip) => {
  if (!ipRestrictions[ip]) return false;
  
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - ipRestrictions[ip].timestamp;
  
  return elapsed < restrictionTime;
};

// Helper to get time remaining for restriction
const getTimeRemaining = (ip) => {
  if (!ipRestrictions[ip]) return 0;
  
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - ipRestrictions[ip].timestamp;
  const remaining = restrictionTime - elapsed;
  
  return remaining > 0 ? remaining : 0;
};

// Check status endpoint
app.get('/check-status', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;
  const cookieData = req.cookies[COOKIE_NAME];
  
  // Check cookie first
  if (cookieData) {
    try {
      const data = JSON.parse(cookieData);
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - data.timestamp;
      
      if (elapsed < restrictionTime) {
        return res.json({
          restricted: true,
          timeLeft: restrictionTime - elapsed,
          message: 'You recently claimed a coupon'
        });
      }
    } catch (err) {
      // Invalid cookie, continue
    }
  }
  
  // Check IP restriction
  if (isRestricted(ip)) {
    return res.json({
      restricted: true,
      timeLeft: getTimeRemaining(ip),
      message: 'Your IP recently claimed a coupon'
    });
  }
  
  // No restrictions
  return res.json({
    restricted: false
  });
});

// Claim coupon endpoint
app.post('/claim-coupon', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;
  const cookieData = req.cookies[COOKIE_NAME];
  
  // Check cookie first
  if (cookieData) {
    try {
      const data = JSON.parse(cookieData);
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - data.timestamp;
      
      if (elapsed < restrictionTime) {
        return res.status(429).json({
          message: 'You recently claimed a coupon',
          timeLeft: restrictionTime - elapsed
        });
      }
    } catch (err) {
      // Invalid cookie, continue
    }
  }
  
  // Check IP restriction
  if (isRestricted(ip)) {
    return res.status(429).json({
      message: 'Your IP recently claimed a coupon',
      timeLeft: getTimeRemaining(ip)
    });
  }
  
  // Get coupon in round-robin fashion
  const coupon = coupons[currentCouponIndex];
  currentCouponIndex = (currentCouponIndex + 1) % coupons.length;
  
  // Record restriction
  const timestamp = Math.floor(Date.now() / 1000);
  ipRestrictions[ip] = { timestamp, coupon };
  
  // Set cookie
  res.cookie(COOKIE_NAME, JSON.stringify({ timestamp, coupon }), {
    maxAge: restrictionTime * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  
  // Return success
  res.json({
    success: true,
    coupon,
    restrictionTime
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});