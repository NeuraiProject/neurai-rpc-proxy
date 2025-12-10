const NeuraiRPC = require("@neuraiproject/neurai-rpc");

const getConfig = require("./getConfig");
const config = getConfig();
const allNodes = [];
const allDePinNodes = [];

/**
 * Convert RPC URL to DePIN URL by changing port
 * 19001 -> 19002 (mainnet)
 * 19101 -> 19102 (testnet)
 */
function convertToDePinUrl(neuraiUrl) {
  return neuraiUrl.replace(':19001', ':19002').replace(':19101', ':19102');
}

//At startup initialize all RPCs, you can have one or multiple Neurai nodes
for (const node of config.nodes) {
  const rpc = NeuraiRPC.getRPC(node.username, node.password, node.neurai_url);
  allNodes.push({ name: node.name, rpc, neuraiUrl: node.neurai_url });
  
  // Initialize DePIN only if explicitly enabled for this node
  if (node.depin_enabled === true) {
    // Use explicit depin_url if provided, otherwise auto-convert
    const depinUrl = node.depin_url || convertToDePinUrl(node.neurai_url);
    allDePinNodes.push({ 
      name: node.name, 
      depinUrl,
      neuraiUrl: node.neurai_url,
      active: false 
    });
  }
}

/* Every x seconds, check the status of the nodes */
async function healthCheck() {
  for (const node of allNodes) {
    try {
      const a = await node.rpc("getbestblockhash", []);
      node.bestblockhash = a;
   
      node.active = true;
    } catch {
      node.active = false;
    }
  }
  
  // Health check for DePIN nodes
  for (const depinNode of allDePinNodes) {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(depinNode.depinUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'PING\n',
        timeout: 5000
      });
      depinNode.active = response.ok;
    } catch {
      depinNode.active = false;
    }
  }
}
setInterval(healthCheck, 10 * 1000);
healthCheck();

 
function getRPCNode() {
  
  for (const n of allNodes) {
    if (n.active === true) {
      return {
        rpc: n.rpc,
        name: n.name,
      };
    }
  }
  //We did not find any active node so we return the first
  return {
    name: allNodes[0].name,
    rpc: allNodes[0].rpc,
  };
}
function getNodes() {
  const list = [];
  for (const n of allNodes) {
    list.push({
      active: n.active,
      bestblockhash: n.bestblockhash,
      name: n.name,
    });
  }
  return list;
}

function getDePinNode() {
  // Return first active DePIN node
  for (const n of allDePinNodes) {
    if (n.active === true) {
      return {
        depinUrl: n.depinUrl,
        name: n.name,
      };
    }
  }
  // No active node found, return first one anyway
  if (allDePinNodes.length > 0) {
    return {
      depinUrl: allDePinNodes[0].depinUrl,
      name: allDePinNodes[0].name,
    };
  }
  // No DePIN nodes configured, return default
  return {
    depinUrl: 'http://localhost:19002',
    name: 'Default DePIN',
  };
}

function getDePinNodes() {
  const list = [];
  for (const n of allDePinNodes) {
    list.push({
      active: n.active,
      depinUrl: n.depinUrl,
      name: n.name,
    });
  }
  return list;
}

module.exports = { getRPCNode, getNodes, getDePinNode, getDePinNodes };
