![neurai-rpc-proxy — a whitelisted HTTP gateway in front of a Neurai node](docs/banner.svg)

# neurai-rpc-proxy

## A Web API for Neurai

**Purpose**: make Neurai blockchain available via HTTP/WEB by exposing the RPC-API via a Proxy that only allows an explicitly approved set of methods.

Check out this software live at:

**MAIN**: https://rpc-main.neurai.org

**TESTNET**: https://rpc-testnet.neurai.org

## Features

- **Standard RPC Proxy** (`/rpc`) - Expose standard Neurai RPC calls with caching
- **DePIN Support** - DePIN (Decentralized Physical Infrastructure Network) commands are served through `/rpc` like any other method
- **Smart Caching** - Cache responses based on block height to reduce node load
- **Queue Management** - Control concurrent requests to your Neurai node
- **Whitelist Protection** - Only allow an explicitly approved set of methods. Mostly reads, plus a few writes that carry their own proof (`sendrawtransaction`, `depinsubmitmsg`); anything needing the node's wallet or private keys stays out
- **Multi-Node Support** - Automatic failover between multiple Neurai nodes

## DePIN Support

**The `/depin` endpoint has been removed** (it now answers `410 Gone`). Every `depin*`
command is a regular node RPC served on the standard RPC port, so they go through
`/rpc` like `getblockcount` or any other whitelisted method — no challenge/response,
no separate transport.

The DePIN messaging gateway (raw TCP, port 19002) is a **node-to-node** transport used
by one node to reach another node's pool. This proxy talks to its own node and never
connects to it.

Reading is straightforward:

```javascript
//Pool and section info
rpc("depingetmsginfo", []).then(console.log);
rpc("depinlistsections", []).then(console.log);

//Messages for one address, paginated
rpc("depinreceivemsg", ["&YOURTOKEN", "NYourNeuraiAddress", 0, "", 5]).then(console.log);
```

### Sending messages

Use `depinsubmitmsg`. The node validates and stores; it never holds your keys:

```javascript
rpc("depinsubmitmsg", [hexEncodedMessage]).then(console.log);
```

> **The client must build that payload.** `depinsubmitmsg` takes a `CDepinMessage`
> that is already serialized, encrypted (ECIES) and signed — either hex-encoded or
> wrapped as `{sender, encrypted}`. **Neither this proxy nor `@neuraiproject/neurai-rpc`
> builds it**: the package root (`@neuraiproject/neurai-rpc`) exports only `getRPC` and
> `methods`, and the Node.js-only subpath `@neuraiproject/neurai-rpc/depin` exports
> `getDePinRPC` and `requestDePinChallenge` — gateway transport, not cryptography. No
> primitive in either entry builds the payload. The wire format is documented in
> the package's `DEPIN_IMPLEMENTATION_GUIDE_EN.md` §3.1 (ECDH → KDF-SHA256 →
> AES-256-CBC → HMAC-SHA256, payload `ephemeral_pubkey || iv || ciphertext || mac`).
> Implementing it is a client-side prerequisite.

### Methods that are deliberately NOT whitelisted

These need keys in the node's wallet, and the proxy is meant to front a node running
with `disablewallet=1`:

| Method | Why |
|---|---|
| `depingetmsg` | Decrypts with the node's wallet keys |
| `depinsendmsg` | `fromaddress` must be a wallet address (signs + encrypts) |
| `depinpoolpkey` | Needs the wallet loaded and unlocked at startup |
| `listpqaddresses` | Lists post-quantum addresses *in the wallet* |

`depinpoolpkey` is the first one worth re-enabling if this proxy ever fronts a node
with a wallet: without it `depinreceivemsg` has no privacy layer.

### Abuse limits

`depinsubmitmsg` is a write that the proxy does not authenticate — the node validates
integrity, but **this proxy has no rate limiting** (the same is already true of
`sendrawtransaction`). If you expose it publicly, put rate limiting in front of it.


## How do I use this software?

When your local proxy is up and running you send requests using HTTP Post.
The body of the request should contain string **method** and array **params** 

### Example for web browser and Node.js 18+
```
//Get block count
rpc("getblockcount", []).then(function (count) {
    console.log("Block count", count);
});

//Get transactions in mempool
rpc("getrawmempool", []).then(function (data) {
    console.log("There are", data.length, "transactions in mempool right now");
});

//Get specific transaction
rpc("getrawtransaction", ["301ec56896153463576c47ac40956e58d2b9fa7de87fad39128c5ae0af66b6a4", true]).then(transaction => {
    console.log("Transaction", transaction.hash, "has", transaction.confirmations, "confirmations");
})

//Get address balance
rpc("getaddressbalance", [{ "addresses": ["RXissueSubAssetXXXXXXXXXXXXXWcwhwL"] }]).then(balance => {
    const sum = balance.balance / 1e8;//divide by 100 000 000;
    console.log("RXissueSubAssetXXXXXXXXXXXXXWcwhwL balance", sum.toLocaleString());
})


async function rpc(method, params) {
    const data = { method, params };
    const URL = 'https://xna-main.neurai.org/rpc'; //replace with your endpoint
    const response = await fetch(URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data) // body data type must match "Content-Type" header
    });
    const obj = await response.json(); // parses JSON response into native JavaScript objects 
    return obj.result;
} 
``` 
## Features and limitations

This software lives up to parts of the JSON-RPC 2.0 Specification
https://www.jsonrpc.org/specification

According to JSON-RPC 2.0 a request object could contain four attributes, jsonrpc, method, params and id.
- This software only supports **method** and **params**.
- This software does NOT support **id**
- This software hardcodes **jsonrpc** to "2.0"
- This sofware does NOT support batch calls.

## How to install
```
git clone https://github.com/neuraiproject/neurai-rpc-proxy.git
cd neurai-rpc-proxy
npm install 
```

### How do I configure this software?
Configure your setup in ./config.json

**Standard configuration:**
```json
{
    "concurrency": 4,
    "endpoint": "https://rpc-main.neurai.org/rpc",
    "environment": "Neurai",
    "local_port": 19999,
    "nodes": [
      {
        "name": "Node number 1",
        "username": "dauser",
        "password": "dapassword",
        "neurai_url": "http://localhost:19001"
      }
    ]
}
```

**Configuration Options:**
- `concurrency` - Number of concurrent requests to handle
- `endpoint` - Public endpoint URL (displayed in UI)
- `environment` - Environment name (displayed in UI)
- `local_port` - Port for the proxy server
- `nodes` - Array of Neurai nodes for failover

### How should my Neurai node be configured?

**For standard RPC:**
```
server=1 
listen=1

# Full transaction index
txindex=1

# Address index (needed for getaddress* calls)
addressindex=1

# Asset index (needed for getassetdata)
assetindex=1

# Timestamp index
timestampindex=1

# Maintains the full Spent index on your node. Default is 0.
spentindex=1

# Username and password - set secure username/password
rpcuser=secret
rpcpassword=secret

# What IP address is allowed to make calls to the RPC server.
rpcallowip=127.0.0.1

dbcache=4096
```

**For DePIN messaging (add to above):**

Option names come from the `neuraid` binary itself. They all start with `depinmsg`
(except `depinpoolsize`) — do not use `depin=1` / `depinport`, which the node ignores.

```
# Enable the DePIN messaging pool. This is what makes the depin* RPCs work.
depinmsg=1

# Messaging token. MUST be an asset that already exists on chain, INCLUDING the
# '&' prefix of dedicated DePIN assets. Without the '&' the node never finds the
# asset, the pool stays uninitialized, and the RPCs fail with "pool not
# initialized" even though depingetmsginfo still reports enabled:true.
depinmsgtoken=&YOURTOKEN

# Gateway port. Node-to-node only — this proxy does not use it. Default 19002.
depinmsgport=19002

# Bind address of the gateway. Only needed if OTHER nodes must reach this pool;
# the gateway does not authenticate its public methods, so firewall it.
#depinmsgbind=0.0.0.0

depinmsgsize=1024      # max message size (bytes)
depinmsgexpire=168     # message expiry (hours)
depinpoolsize=100      # message pool size (MB)

# REQUIRED for DePIN, on top of the standard indexes above:
assetindex=1
pubkeyindex=1
```

Verify with `neurai-cli depingetmsginfo`: it must report `enabled:true` **and** the
right token. If the pool did not initialize, check the asset exists with
`getassetdata "&YOURTOKEN"` — `null` means it does not.

**Node compatibility:** `depinreceivemsg`, `depingetancestorrecipients`,
`depinlistsections` and `depinpoolpkey` need a node from July 2026 or newer.
`createrawtransaction`'s `refinputs` parameter needs one from April 2026.

## Sir, how do I start this application?

```
npm start
```

## Help with Neurai RPC calls, arguments and stuff
Go to https://xna-main.neurai.org/ for in depth description of each RPC call


## List of Neurai RPC calls
This is a raw list, a lot of these calls are not whitelisted.
For example we do NOT let developers call procedure `dumpprivkey`
```
== Addressindex ==
getaddressbalance
getaddressdeltas
getaddressmempool
getaddresstxids
getaddressutxos

== Assets ==
getassetdata "asset_name"
getcacheinfo 
getsnapshot "asset_name" block_height
issue "asset_name" qty "( to_address )" "( change_address )" ( units ) ( reissuable ) ( has_ipfs ) "( ipfs_hash )"
issueunique "root_name" [asset_tags] ( [ipfs_hashes] ) "( to_address )" "( change_address )"
listaddressesbyasset "asset_name" (onlytotal) (count) (start)
listassetbalancesbyaddress "address" (onlytotal) (count) (start)
listassets "( asset )" ( verbose ) ( count ) ( start )
listmyassets "( asset )" ( verbose ) ( count ) ( start ) (confs) 
purgesnapshot "asset_name" block_height
reissue "asset_name" qty "to_address" "change_address" ( reissuable ) ( new_units) "( new_ipfs )" 
transfer "asset_name" qty "to_address" "message" expire_time "change_address" "asset_change_address"
transferfromaddress "asset_name" "from_address" qty "to_address" "message" expire_time "rvn_change_address" "asset_change_address"
transferfromaddresses "asset_name" ["from_addresses"] qty "to_address" "message" expire_time "rvn_change_address" "asset_change_address"

== Blockchain ==
clearmempool
decodeblock "blockhex"
getbestblockhash
getblock "blockhash" ( verbosity ) 
getblockchaininfo
getblockcount

getblockhash height
getblockhashes timestamp
getblockheader "hash" ( verbose )
getchaintips
getchaintxstats ( nblocks blockhash )
getdifficulty
getmempoolancestors txid (verbose)
getmempooldescendants txid (verbose)
getmempoolentry txid
getmempoolinfo
getrawmempool ( verbose )
getspentinfo
gettxout "txid" n ( include_mempool )
gettxoutproof ["txid",...] ( blockhash )
gettxoutsetinfo
preciousblock "blockhash"
pruneblockchain
savemempool
verifychain ( checklevel nblocks )
verifytxoutproof "proof"

== Control ==
getinfo
getmemoryinfo ("mode")
getrpcinfo
help ( "command" )
stop
uptime

== Generating ==
generate nblocks ( maxtries )
generatetoaddress nblocks address (maxtries)
getgenerate
setgenerate generate ( genproclimit )

== Messages ==
clearmessages 
sendmessage "channel_name" "ipfs_hash" (expire_time)
subscribetochannel 
unsubscribefromchannel 
viewallmessagechannels 
viewallmessages 

== Mining ==
getblocktemplate ( TemplateRequest )
getkawpowhash "header_hash" "mix_hash" nonce, height, "target"
getmininginfo
getnetworkhashps ( nblocks height )
pprpcsb "header_hash" "mix_hash" "nonce"
prioritisetransaction <txid> <dummy value> <fee delta>
submitblock "hexdata"  ( "dummy" )

== Network ==
addnode "node" "add|remove|onetry"
clearbanned
disconnectnode "[address]" [nodeid]
getaddednodeinfo ( "node" )
getconnectioncount
getnettotals
getnetworkinfo
getpeerinfo
listbanned
ping
setban "subnet" "add|remove" (bantime) (absolute)
setnetworkactive true|false

== Rawtransactions ==
combinerawtransaction ["hexstring",...]
createrawtransaction [{"txid":"id","vout":n},...] {"address":(amount or object),"data":"hex",...}
decoderawtransaction "hexstring"
decodescript "hexstring"
fundrawtransaction "hexstring" ( options )
getrawtransaction "txid" ( verbose )
sendrawtransaction "hexstring" ( allowhighfees )
signrawtransaction "hexstring" ( [{"txid":"id","vout":n,"scriptPubKey":"hex","redeemScript":"hex"},...] ["privatekey1",...] sighashtype )
testmempoolaccept ["rawtxs"] ( allowhighfees )

== Restricted assets ==
addtagtoaddress tag_name to_address (change_address) (asset_data)
checkaddressrestriction address restricted_name
checkaddresstag address tag_name
checkglobalrestriction restricted_name
freezeaddress asset_name address (change_address) (asset_data)
freezerestrictedasset asset_name (change_address) (asset_data)
getverifierstring restricted_name
issuequalifierasset "asset_name" qty "( to_address )" "( change_address )" ( has_ipfs ) "( ipfs_hash )"
issuerestrictedasset "asset_name" qty "verifier" "to_address" "( change_address )" (units) ( reissuable ) ( has_ipfs ) "( ipfs_hash )"
isvalidverifierstring verifier_string
listaddressesfortag tag_name
listaddressrestrictions address
listglobalrestrictions
listtagsforaddress address
reissuerestrictedasset "asset_name" qty to_address ( change_verifier ) ( "new_verifier" ) "( change_address )" ( new_units ) ( reissuable ) "( new_ipfs )"
removetagfromaddress tag_name to_address (change_address) (asset_data)
transferqualifier "qualifier_name" qty "to_address" ("change_address") ("message") (expire_time) 
unfreezeaddress asset_name address (change_address) (asset_data)
unfreezerestrictedasset asset_name (change_address) (asset_data)

== Restricted ==
viewmyrestrictedaddresses 
viewmytaggedaddresses 

== Rewards ==
cancelsnapshotrequest "asset_name" block_height
distributereward "asset_name" snapshot_height "distribution_asset_name" gross_distribution_amount ( "exception_addresses" ) ("change_address") ("dry_run")
getdistributestatus "asset_name" snapshot_height "distribution_asset_name" gross_distribution_amount ( "exception_addresses" )
getsnapshotrequest "asset_name" block_height
listsnapshotrequests ["asset_name" [block_height]]
requestsnapshot "asset_name" block_height

== Util ==
createmultisig nrequired ["key",...]
estimatefee nblocks
estimatesmartfee conf_target ("estimate_mode")
signmessagewithprivkey "privkey" "message"
validateaddress "address"
verifymessage "address" "signature" "message"

== Wallet ==
abandontransaction "txid"
abortrescan
addmultisigaddress nrequired ["key",...] ( "account" )
addwitnessaddress "address"
backupwallet "destination"
bumpfee has been deprecated on the RVN Wallet.
dumpprivkey "address"
dumpwallet "filename"
encryptwallet "passphrase"
getaccount "address"
getaccountaddress "account"
getaddressesbyaccount "account"
getbalance ( "account" minconf include_watchonly )
getmasterkeyinfo
getmywords ( "account" )
getnewaddress ( "account" )
getrawchangeaddress
getreceivedbyaccount "account" ( minconf )
getreceivedbyaddress "address" ( minconf )
gettransaction "txid" ( include_watchonly )
getunconfirmedbalance
getwalletinfo
importaddress "address" ( "label" rescan p2sh )
importmulti "requests" ( "options" )
importprivkey "privkey" ( "label" ) ( rescan )
importprunedfunds
importpubkey "pubkey" ( "label" rescan )
importwallet "filename"
keypoolrefill ( newsize )
listaccounts ( minconf include_watchonly)
listaddressgroupings
listlockunspent
listreceivedbyaccount ( minconf include_empty include_watchonly)
listreceivedbyaddress ( minconf include_empty include_watchonly)
listsinceblock ( "blockhash" target_confirmations include_watchonly include_removed )
listtransactions ( "account" count skip include_watchonly)
listunspent ( minconf maxconf  ["addresses",...] [include_unsafe] [query_options])
listwallets
lockunspent unlock ([{"txid":"txid","vout":n},...])
move "fromaccount" "toaccount" amount ( minconf "comment" )
removeprunedfunds "txid"
rescanblockchain ("start_height") ("stop_height")
sendfrom "fromaccount" "toaddress" amount ( minconf "comment" "comment_to" )
sendfromaddress "from_address" "to_address" amount ( "comment" "comment_to" subtractfeefromamount replaceable conf_target "estimate_mode")
sendmany "fromaccount" {"address":amount,...} ( minconf "comment" ["address",...] replaceable conf_target "estimate_mode")
sendtoaddress "address" amount ( "comment" "comment_to" subtractfeefromamount replaceable conf_target "estimate_mode")
setaccount "address" "account"
settxfee amount
signmessage "address" "message"

```
