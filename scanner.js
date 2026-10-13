const axios = require('axios');
const Gem = require('./models/Gem');

/**
 * Analyzes the token description for "spammy" keywords.
 * Returns a penalty multiplier (0.0 to 1.0).
 */
function analyzeDescription(description) {
    if (!description || description === 'Unknown') return 0.8; // Penalty for missing description
    
    const spamWords = ['moon', 'safe', 'elon', 'pump', 'rocket', 'millionaire', 'guaranteed', 'airdrop'];
    let penalty = 1.0;
    const lowerDesc = description.toLowerCase();
    
    const hits = spamWords.filter(word => lowerDesc.includes(word)).length;
    penalty -= (hits * 0.15); // Subtract 15% for every spam word found
    
    return Math.max(0.2, penalty); // Never drop below 20% confidence
}

async function scanForGems() {
    console.log('[Scanner] Scanning for new tokens...');
    try {
        const response = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1');
        const profiles = response.data;

        console.log(`[Scanner] Found ${profiles.length} profiles. Filtering...`);
        
        let premiumCount = 0;
        let publicCount = 0;

        for (const profile of profiles) {
            const links = profile.links || [];
            const website = links.find(l => l.label === 'Website')?.url;
            const twitter = links.find(l => l.type === 'twitter' || (l.url && l.url.includes('x.com')))?.url;
            
            if (website || twitter) {
                // 1. Base Confidence Score
                let confidence = 0;
                if (website && twitter) {
                    confidence = 80; // Strong digital footprint
                } else {
                    confidence = 40; // Partial footprint
                }

                // 2. Description Penalty
                const descPenalty = analyzeDescription(profile.description);
                confidence *= descPenalty;

                // 3. Premium Designation
                // Now based on a threshold of confidence rather than just a binary check
                const isPremium = confidence > 60;

                await Gem.findOneAndUpdate(
                    { tokenAddress: profile.tokenAddress },
                    {
                        name: profile.description || 'Unknown',
                        chain: profile.chainId,
                        website: website || 'N/A',
                        twitter: twitter || 'N/A',
                        isPremium: isPremium,
                        confidenceScore: Math.round(confidence),
                        lastUpdated: new Date()
                    },
                    { upsert: true }
                );

                if (isPremium) premiumCount++; else publicCount++;
            }
        }

        console.log(`[Scanner] Sync complete. Premium: ${premiumCount}, Public: ${publicCount}`);
    } catch (error) {
        console.error('[Scanner] Error:', error.message);
    }
}

module.exports = { scanForGems };
