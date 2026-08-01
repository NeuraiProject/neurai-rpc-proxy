let cache = {};

let methodsRequested = {};

function addMethod(name, date) {
  methodsRequested[name] = date;
}
function getMethods() {
  return methodsRequested;
}
function createKey(method, params) {
  return JSON.stringify({ method, params });
}

function getKeys() {
  return Object.keys(cache);
}
function put(method, params, promise) {
  const key = createKey(method, params);
  cache[key] = promise;
}

function clear() {
  cache = {};
}
function remove(method, params) {
  const key = createKey(method, params);
  delete cache[key];
}
function get(method, params) {
  const key = createKey(method, params);
  const promise = cache[key];
  return promise;
}
function shouldCache(method) {
  //== Addressindex ==
  const cacheableMethods = [
    "== Addressindex ==",
    "getaddressbalance",
    "getaddressdeltas",
    //"getaddressmempool",
    "getaddresstxids",
    "getaddressutxos",
    "== Assets ==",
    "getassetdata",
    //  "getcacheinfo",
    //  "getsnapshot",
    //  "issue",
    //  "issueunique",
    "listaddressesbyasset",
    "listassetbalancesbyaddress",
    "listassets",
    //  "listmyassets",
    //  "purgesnapshot",
    //  "reissue",
    //  "transfer",
    //  "transferfromaddress",
    //  "transferfromaddresses",
    //  "== Blockchain ==",
    //  "clearmempool",
    "decodeblock",
    "getbestblockhash",
    "getblock",
    "getblockchaininfo",
    "getblockcount",
    "getblockhash",
    "getblockhashes",
    "getblockheader",
    //"getchaintips",
    "getchaintxstats",
    "getdifficulty",
    //"getmempoolancestors",
    //"getmempooldescendants",
    //"getmempoolentry",
    //"getmempoolinfo",
    //"getrawmempool",
    "getpubkey",
    "getspentinfo",
    "gettxout",
    "gettxoutproof",
    "gettxoutsetinfo",
    "preciousblock",
    // "pruneblockchain",
    //  "savemempool",
    "verifychain",
    "verifytxoutproof",
    "== Control ==",
    //  "getinfo",
  //  "getmemoryinfo",
  //  "getrpcinfo",
    "help",
    "stop",
    "uptime",
    //  "== Generating ==",
    //  "generate",
    //  "generatetoaddress",
    //  "getgenerate",
    //  "setgenerate",
    //  "== Messages ==",
    //  "clearmessages",
    //  "sendmessage",
    //  "subscribetochannel",
    //  "unsubscribefromchannel",
    //  "viewallmessagechannels",
    //  "viewallmessages",
    //  "== Mining ==",
    //  "getblocktemplate",
    //  "getkawpowhash",
    //  "getmininginfo",
    //  "getnetworkhashps",
    //  "pprpcsb",
    //  "prioritisetransaction",
    //  "submitblock",
    //  "== Network ==",
    //  "addnode",
    //  "clearbanned",
    //  "disconnectnode",
    //  "getaddednodeinfo",
    //  "getconnectioncount",
    //  "getnettotals",
    //  "getnetworkinfo",
    //  "getpeerinfo",
    //  "listbanned",
    //  "ping",
    //  "setban",
    //  "setnetworkactive",
    //  "== Rawtransactions ==",
    ///"combinerawtransaction",
    //"createrawtransaction",
    "decoderawtransaction",
    "decodescript",
    //  "fundrawtransaction",
    //"getrawtransaction",
    //"sendrawtransaction",
   // "signrawtransaction",
    //"testmempoolaccept",
    //  "== Restricted assets ==",
    //  "addtagtoaddress",
    "checkaddressrestriction",
    "checkaddresstag",
    "checkglobalrestriction",
    //  "freezeaddress",
    //  "freezerestrictedasset",
    "getverifierstring",
    //  "issuequalifierasset",
    //  "issuerestrictedasset",
    "isvalidverifierstring",
    "listaddressesfortag",
    "listaddressrestrictions",
    "listglobalrestrictions",
    "listtagsforaddress",
    //  "reissuerestrictedasset",
    //  "removetagfromaddress",
    //  "transferqualifier",
    //  "unfreezeaddress",
    //  "unfreezerestrictedasset",
    //  "== Restricted ==",
    //  "viewmyrestrictedaddresses",
    //  "viewmytaggedaddresses",
    //  "== Rewards ==",
    //  "cancelsnapshotrequest",
    //  "distributereward",
    //  "getdistributestatus",
    //  "getsnapshotrequest",
    //  "listsnapshotrequests",
    //  "requestsnapshot",
    //  "== Util ==",
    //"createmultisig",
    //"estimatefee",
    //"estimatesmartfee",
    //"signmessagewithprivkey",
    "validateaddress",
    "verifymessage",
    "== Depin asset ==",
    // Chain-derived, so the per-block cache is correct for these.
    "checkdepinvalidity",
    //  "freezedepin",
    "listdepinholders",
    "listdepinaddresses",
    //  "selfrevokedepin",
    //  "unfreezedepin",
    "== Depin messaging ==",
    // NOTHING here is cacheable. The cache is invalidated on a new best block
    // hash, but the message pool does not follow blocks: a message that lands in
    // the pool would stay invisible until the next block.
    //  "depinclearmsg",
    //  "depingetmsginfo",     // messages, memoryusage, oldest/newestmessage
    //  "depingetpoolcontent", // pool contents
    //  "depinmcpstatus",      // commands_processed, tasks_in_flight, last_poll_time
    //  "depinpoolstats",      // pool statistics
    //  "depinreceivemsg",     // pool contents
    //  "depinlistsections",   // with an address it returns per-section message
    //                         // counts, and shouldCache() only sees the method
    //                         // name, so the two shapes cannot be told apart
    //  "depinsendmsg", // Write command - do not cache
    //  "depinsubmitmsg", // Write command - do not cache
    "== Wallet ==",
    //  "abandontransaction",
    //  "abortrescan",
    //  "addmultisigaddress",
    //  "addwitnessaddress",
    //  "backupwallet",
    //  "bumpfee",
    //  "dumpprivkey",
    //  "dumpwallet",
    //  "encryptwallet",
    //  "getaccount",
    //  "getaccountaddress",
    //  "getaddressesbyaccount",
    //  "getbalance",
    //  "getmasterkeyinfo",
    //  "getmywords",
    //  "getnewaddress",
    //  "getrawchangeaddress",
    //  "getreceivedbyaccount",
    //  "getreceivedbyaddress",
    //  "gettransaction",
    //  "getunconfirmedbalance",
    //  "getwalletinfo",
    //  "importaddress",
    //  "importmulti",
    //  "importprivkey",
    //  "importprunedfunds",
    //  "importpubkey",
    //  "importwallet",
    //  "keypoolrefill",
    //  "listaccounts",
    //  "listaddressgroupings",
    //  "listlockunspent",
    //  "listreceivedbyaccount",
    //  "listreceivedbyaddress",
    //  "listsinceblock",
    //  "listtransactions",
    //  "listunspent",
    //  "listwallets",
    //  "lockunspent",
    //  "move",
    //  "removeprunedfunds",
    //  "rescanblockchain",
    //  "sendfrom",
    //  "sendfromaddress",
    //  "sendmany",
    //  "sendtoaddress",
    //  "setaccount",
    //  "settxfee",
    //  "signmessage"
  ];

  return cacheableMethods.includes(method);
}
module.exports = {
  addMethod,
  clear,
  get,
  getKeys,
  getMethods,
  put,
  remove,
  shouldCache,
};
