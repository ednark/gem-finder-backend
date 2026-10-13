require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { ethers } = require('ethers');
const Gem = require('./models/Gem');
const { scanForGems } = require('./scanner');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// --- Blockchain Config ---
const RPC_URL = process.env.RPC_URL;
const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS; // Now using Registry instead of GemFinder address
const REGISTRY_ABI = [
    "function getGemFinderAddress() public view returns (address)"
];
const GEM_FINDER_ABI = [
    "function isSubscribed(address user) public view returns (bool)"
];

async function checkSubscription(userAddress) {
    if (!RPC_URL || !REGISTRY_ADDRESS) return false;
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        
        // 1. Resolve the current GemFinder address from the Registry
        const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
        const gemFinderAddress = await registry.getGemFinderAddress();
        
        if (!gemFinderAddress) {
            console.error('[Auth] Registry returned no GemFinder address');
            return false;
        }

        // 2. Query the resolved GemFinder contract
        const gemFinder = new ethers.Contract(gemFinderAddress, GEM_FINDER_ABI, provider);
        return await gemFinder.isSubscribed(userAddress);
    } catch (e) {
        console.error('[Auth] Subscription check failed:', e.message);
        return false;
    }
}

// --- Routes ---

// Get Gems: Filtered by subscription status
app.get('/api/gems', async (req, res) => {
    const { address } = req.query;
    
    try {
        let isSubscribed = false;
        if (address) {
            isSubscribed = await checkSubscription(address);
        }

        // If subscribed, give all. If not, only non-premium.
        const filter = isSubscribed ? {} : { isPremium: false };
        const gems = await Gem.find(filter).sort({ lastUpdated: -1 }).limit(50);
        
        res.json({
            gems,
            isPremium: isSubscribed,
            count: gems.length
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Trigger manual scan
app.post('/api/scan', async (req, res) => {
    try {
        await scanForGems();
        res.json({ message: 'Scan triggered successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Database connection and server start
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB Atlas');
        
        // Start the scanner on a timer (e.g., every 30 mins)
        setInterval(scanForGems, 30 * 60 * 1000);
        await scanForGems(); // Initial scan on startup

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => console.error('MongoDB connection error:', err));
