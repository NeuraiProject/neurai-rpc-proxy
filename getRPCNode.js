const NeuraiRPC = require("@neuraiproject/neurai-rpc");

const getConfig = require("./getConfig");
const config = getConfig();
const allNodes = [];

//At startup initialize all RPCs, you can have one or multiple Neurai nodes
for (const node of config.nodes) {
  const rpc = NeuraiRPC.getRPC(node.username, node.password, node.neurai_url);
  allNodes.push({ name: node.name, rpc, neuraiUrl: node.neurai_url });

  // depin_enabled/depin_url used to point at a DePIN gateway port that no longer exists. The
  // proxy no longer talks to it: every depin* command is a regular RPC on the
  // node URL above. Warn instead of failing so old config.json files still boot.
  if (node.depin_enabled !== undefined || node.depin_url !== undefined) {
    console.log(
      `Node "${node.name}": depin_enabled/depin_url are obsolete and ignored. ` +
        "DePIN commands now go through the standard RPC port."
    );
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
}
//unref so the health check alone never keeps the process alive
setInterval(healthCheck, 10 * 1000).unref();
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

module.exports = { getRPCNode, getNodes };
