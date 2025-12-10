const fetch = require('node-fetch');

/**
 * DePIN Challenge Cache
 * Stores active challenges with their expiration times
 */
const challengeCache = new Map();

/**
 * Clean expired challenges from cache
 */
function cleanExpiredChallenges() {
  const now = Date.now();
  for (const [key, value] of challengeCache.entries()) {
    if (value.expiresAt <= now) {
      challengeCache.delete(key);
    }
  }
}

// Clean expired challenges every 30 seconds
setInterval(cleanExpiredChallenges, 30000);

/**
 * Request a challenge from the DePIN server
 * @param {string} depinUrl - DePIN server URL (e.g., http://localhost:19002)
 * @param {string} address - Neurai address requesting the challenge
 * @returns {Promise<{challenge: string, timeout: number, expiresAt: number}>}
 */
async function requestChallenge(depinUrl, address) {
  const cacheKey = `${depinUrl}:${address}`;
  
  // Check if we have a valid cached challenge
  const cached = challengeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  // Request new challenge
  const authMessage = `AUTH ${address}\n`;
  
  const response = await fetch(depinUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: authMessage,
  });

  if (!response.ok) {
    throw new Error(`Failed to request challenge: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  
  // Parse CHALLENGE response
  const match = text.match(/^CHALLENGE ([a-f0-9]+) (\d+)$/);
  if (!match) {
    throw new Error(`Invalid challenge response: ${text}`);
  }

  const challenge = match[1];
  const timeout = parseInt(match[2], 10);
  
  // Cache the challenge with 5 second buffer before expiration
  const expiresAt = Date.now() + (timeout - 5) * 1000;
  
  const challengeData = {
    challenge,
    timeout,
    expiresAt,
  };
  
  challengeCache.set(cacheKey, challengeData);
  
  return challengeData;
}

/**
 * Send an authenticated RPC request to DePIN server
 * @param {string} depinUrl - DePIN server URL
 * @param {string} address - Neurai address
 * @param {string} signature - Base64-encoded signature of the challenge
 * @param {string} method - RPC method name
 * @param {Array} params - RPC method parameters
 * @returns {Promise<any>}
 */
async function sendDePinRequest(depinUrl, address, signature, method, params) {
  const rpcRequest = {
    jsonrpc: '2.0',
    id: 1,
    method,
    params,
  };

  const requestBody = JSON.stringify({
    address,
    signature,
    request: rpcRequest,
  });

  const response = await fetch(depinUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: requestBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DePIN request failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  
  if (result.error) {
    throw new Error(`DePIN RPC error: ${JSON.stringify(result.error)}`);
  }

  return result.result;
}

/**
 * Execute DePIN RPC call with automatic challenge handling
 * @param {string} depinUrl - DePIN server URL
 * @param {string} address - Neurai address
 * @param {Function} signMessage - Function to sign the challenge
 * @param {string} method - RPC method name
 * @param {Array} params - RPC method parameters
 * @param {number} retryCount - Number of retries on challenge expiration
 * @returns {Promise<any>}
 */
async function executeDePinRPC(depinUrl, address, signMessage, method, params, retryCount = 1) {
  try {
    // Get or request challenge
    const { challenge } = await requestChallenge(depinUrl, address);
    
    // Sign the challenge
    const signature = await signMessage(challenge);
    
    // Send authenticated request
    return await sendDePinRequest(depinUrl, address, signature, method, params);
  } catch (error) {
    // If challenge expired and we have retries left, try again with new challenge
    if (retryCount > 0 && error.message.includes('expired')) {
      // Clear cached challenge
      const cacheKey = `${depinUrl}:${address}`;
      challengeCache.delete(cacheKey);
      
      return executeDePinRPC(depinUrl, address, signMessage, method, params, retryCount - 1);
    }
    
    throw error;
  }
}

/**
 * Get cache statistics
 * @returns {Object}
 */
function getCacheStats() {
  const now = Date.now();
  const stats = {
    totalChallenges: challengeCache.size,
    validChallenges: 0,
    expiredChallenges: 0,
    challenges: [],
  };

  for (const [key, value] of challengeCache.entries()) {
    const isValid = value.expiresAt > now;
    if (isValid) {
      stats.validChallenges++;
    } else {
      stats.expiredChallenges++;
    }
    
    stats.challenges.push({
      key,
      expiresAt: new Date(value.expiresAt).toISOString(),
      isValid,
    });
  }

  return stats;
}

/**
 * Clear all cached challenges
 */
function clearCache() {
  challengeCache.clear();
}

module.exports = {
  requestChallenge,
  sendDePinRequest,
  executeDePinRPC,
  getCacheStats,
  clearCache,
};
