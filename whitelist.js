const whitelist = [
  //== Addressindex ==
  "getaddressbalance",
  "getaddressdeltas",
  "getaddressmempool",
  "getaddresstxids",
  "getaddressutxos",

  //== Assets ==
  "getassetdata",
  // "getcacheinfo",
  //"getsnapshot",
  //"issue",
  //"issueunique",
  "listaddressesbyasset",
  "listassetbalancesbyaddress",
  "listassets",
  //"listmyassets",
  //"purgesnapshot",
  //"reissue",
  //"transfer",
  //"transferfromaddress",
  //"transferfromaddresses",

  //== Blockchain ==
  //"clearmempool",
  "decodeblock",
  "getbestblockhash",
  "getblock",
  "getblockchaininfo",
  "getblockcount",
  "getblockhash",
  // "getblockhashes", //This can kill the service if you ask for all block hashes years back
  "getblockheader",
  "getchaintips",
  "getchaintxstats",
  "getdifficulty",
  "getmempoolancestors",
  "getmempooldescendants",
  "getmempoolentry",
  "getmempoolinfo",
  "getrawmempool",
  "getspentinfo",
  "gettxout",
  "gettxoutproof",
  // "gettxoutsetinfo", this method is not "dangerous" but it takes TOO long time
  //"preciousblock",
  //"pruneblockchain",
  //"savemempool",
  //"verifychain",
  //"verifytxoutproof",

  //== Control ==
  //"getinfo",
  //"getmemoryinfo",
  //"getrpcinfo",
  "help",
  //"stop",
  //"uptime",

  //== Generating ==
  //"generate",
  //"generatetoaddress",
  //"getgenerate",
  //"setgenerate",

  //== Messages ==
  //"clearmessages",
  //"sendmessage",
  //"subscribetochannel",
  //"unsubscribefromchannel",
  //"viewallmessagechannels",
  //"viewallmessages",

  //== Mining ==
  // "getblocktemplate",
  //"getkawpowhash",
  //"getmininginfo",
  "getnetworkhashps",
  //"pprpcsb",
  //"prioritisetransaction",
  //"submitblock",

  //== Network ==
  //"addnode",
  //"clearbanned",
  //"disconnectnode",
  //"getaddednodeinfo",
  //"getconnectioncount",
  //"getnettotals",
  //"getnetworkinfo",
  //"getpeerinfo",
  //"listbanned",
  //"ping",
  //"setban",
  //"setnetworkactive",

  //== Rawtransactions ==
  "combinerawtransaction",
  "createrawtransaction",
  "decoderawtransaction",
  "decodescript",
  //"fundrawtransaction",
  "getrawtransaction",
  "sendrawtransaction",
  "signrawtransaction",
  "testmempoolaccept",

  //== Restricted assets ==
  // "addtagtoaddress",
  "checkaddressrestriction",
  "checkaddresstag",
  "checkglobalrestriction",
  //"freezeaddress",
  //"freezerestrictedasset",
  "getverifierstring",
  //"issuequalifierasset",
  //"issuerestrictedasset",
  "isvalidverifierstring",
  "listaddressesfortag",
  "listaddressrestrictions",
  "listglobalrestrictions",
  "listtagsforaddress",
  //"reissuerestrictedasset",
  //"removetagfromaddress",
  //"transferqualifier",
  //"unfreezeaddress",
  //"unfreezerestrictedasset",

  //== Restricted ==
  /*
    "viewmyrestrictedaddresses",
    "viewmytaggedaddresses",
    */

  //== Rewards ==
  /*
    "cancelsnapshotrequest",
    "distributereward",
    "getdistributestatus",
    "getsnapshotrequest",
    "listsnapshotrequests",
    "requestsnapshot",

    */

  //== Util ==
  //"createmultisig",
  "estimatefee",
  "estimatesmartfee",
  "signmessagewithprivkey",
  "validateaddress",
  "verifymessage",

  //== Depin asset ==
  // Methods below are chain queries: they work with disablewallet=1.
  // Anything that needs keys in the node's wallet stays out — see the block at
  // the end of this section.
  "getpubkey",
  "checkdepinvalidity",
  //"freezedepin",
  "depingetancestorrecipients",
  "listdepinholders",
  "listdepinaddresses",
  //"selfrevokedepin",
  //"unfreezedepin",

  //== Depin messaging (protocol 2) ==
  // Reads and purges are authenticated by a challenge the holder signs with
  // its own key (depinchallenge, whose request is itself signed over a
  // timestamp, single-use); replies are encrypted for the holder and signed
  // with the node's pool key. Nothing here needs node credentials beyond the
  // proxy's, and nothing here is cacheable.
  "depinchallenge",
  "depinclearmsg",     // owner-level, challenge-authenticated
  "depinreceivemsg",
  "depinlistsections",
  "depingetmsginfo",   // publishes the pool key (clients pin it on first use)
  "depinmcpstatus",
  "depinpoolstats",
  "depinsubmitmsg",    // Write, but non-custodial: the client encrypts, signs and wraps for the pool key
  // depingetpoolcontent no longer exists in the node (pool-wide metadata with
  // no identity to bind a challenge to).

  //== Depin — the node's OWN wallet; never exposed even though the node has one ==
  // A protocol-2 service node runs a dedicated legacy wallet for its pool key,
  // so these methods exist upstream. They use the node's keys, not the
  // holder's: keep them out. The pool public key is published by
  // depingetmsginfo, so depinpoolpkey is not needed here either.
  //"depingetmsg",        // decrypts with the node's wallet keys
  //"depinsendmsg",       // fromaddress must be a wallet address (signs+encrypts)
  //"depinsignrequest",   // signs a challenge request with the node's wallet keys
  //"depinsignchallenge", // signs a challenge with the node's wallet keys
  //"depindecrypt",       // opens an encrypted reply with the node's wallet keys
  //"depinpoolpkey",      // operator bootstrap: derives the pool key from the service wallet
  //"listpqaddresses",    // lists PQ addresses *in the wallet*

  //== Wallet ==
  /*
    "abandontransaction",
    "abortrescan",
    "addmultisigaddress",
    "addwitnessaddress",
    "backupwallet",
    "bumpfee",
    "dumpprivkey",
    "dumpwallet",
    "encryptwallet",
    "getaccount",
    "getaccountaddress",
    "getaddressesbyaccount",
    "getbalance",
    "getmasterkeyinfo",
    "getmywords",
    "getnewaddress",
    "getrawchangeaddress",
    "getreceivedbyaccount",
    "getreceivedbyaddress",
    "gettransaction",
    "getunconfirmedbalance",
    "getwalletinfo",
    "importaddress",
    "importmulti",
    "importprivkey",
    "importprunedfunds",
    "importpubkey",
    "importwallet",
    "keypoolrefill",
    "listaccounts",
    "listaddressgroupings",
    "listlockunspent",
    "listreceivedbyaccount",
    "listreceivedbyaddress",
    "listsinceblock",
    "listtransactions",
    "listunspent",
    "listwallets",
    "lockunspent",
    "move",
    "removeprunedfunds",
    "rescanblockchain",
    "sendfrom",
    "sendfromaddress",
    "sendmany",
    "sendtoaddress",
    "setaccount",
    "settxfee",
    "signmessage",
     */
];

function isWhitelisted(method) {
  const inc = whitelist.includes(method);
  return inc;
}
module.exports = {
  whitelist,
  isWhitelisted,
};
