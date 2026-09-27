const NeuraiRPC = require("@neuraiproject/neurai-rpc");
const getConfig = require("./getConfig");

const config = getConfig();
const expectedGenesis = config.expected_genesis;
if (typeof expectedGenesis !== "string" || !/^[0-9a-f]{64}$/i.test(expectedGenesis)) {
  throw new Error("config.expected_genesis must be a 64-character block hash");
}

for (const node of config.nodes) {
  if (node.depin_enabled !== undefined || node.depin_url !== undefined) {
    console.warn("depin_enabled and depin_url are obsolete and ignored");
  }
}

const allNodes = config.nodes.map((node) => ({
  name: node.name,
  rpc: NeuraiRPC.getRPC(node.username, node.password, node.neurai_url),
  neuraiUrl: node.neurai_url,
  active: false,
}));

let healthCheckPromise = null;

async function healthCheck() {
  for (const node of allNodes) {
    try {
      const genesis = await node.rpc("getblockhash", [0]);
      if (typeof genesis !== "string" || genesis.toLowerCase() !== expectedGenesis.toLowerCase()) {
        node.active = false;
        node.healthError = "Unexpected genesis block";
        continue;
      }
      node.bestblockhash = await node.rpc("getbestblockhash", []);
      node.active = true;
      node.healthError = undefined;
    } catch (error) {
      node.active = false;
      node.healthError = "RPC health check failed";
    }
  }
}

function refreshHealthCheck() {
  if (!healthCheckPromise) {
    healthCheckPromise = healthCheck().finally(() => { healthCheckPromise = null; });
  }
  return healthCheckPromise;
}

setInterval(() => { void refreshHealthCheck(); }, 10 * 1000).unref();
void refreshHealthCheck();

function getRPCNode() {
  return allNodes.find((node) => node.active) || null;
}

async function getHealthyRPCNode() {
  let node = getRPCNode();
  if (node) return node;
  await refreshHealthCheck();
  node = getRPCNode();
  if (!node) throw new Error("No RPC node matches config.expected_genesis and passes health checks");
  return node;
}

function getNodes() {
  return allNodes.map((node) => ({
    active: node.active,
    bestblockhash: node.bestblockhash,
    healthError: node.healthError,
    name: node.name,
  }));
}

module.exports = { getRPCNode, getHealthyRPCNode, getNodes, refreshHealthCheck };
