const mongoose = require('mongoose');

const gemSchema = new mongoose.Schema({
    tokenAddress: { type: String, required: true, unique: true },
    name: { type: String },
    chain: { type: String },
    website: { type: String },
    twitter: { type: String },
    confidenceScore: { type: Number, default: 0 },
    isPremium: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Gem', gemSchema);
