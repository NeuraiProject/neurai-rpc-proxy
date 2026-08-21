const { methods } = require("@neuraiproject/neurai-rpc");
const { getRPCNode, getNodes } = require("./getRPCNode");
const { default: PQueue } = require("p-queue"); //NOTE version 6 with support for CommonJS
const process = require("process"); //to get memory used
const cacheService = require("./cacheService");
const { getRPCErrorMessage } = require("./rpcError");
const cors = require("cors");
const express = require("express");
const getConfig = require("./getConfig");
const { whitelist, isWhitelisted } = require("./whitelist");
const { createDepinLimiter } = require("./depinRateLimit");

let numberOfRequests = 0;

/* 

1) All requests to Neurai node is queued using "p-queue" and run concurrently, you set concurrency in config.json
2) Most requests are cached for the lifespan of the CURRENT BLOCK

*/
process.on("uncaughtException", (error, origin) => {
  console.log("----- Uncaught exception -----");
  console.log(error);
  console.log("----- Exception origin -----");
  console.log(origin);
});

process.on("unhandledRejection", (reason, promise) => {
  console.log("----- Unhandled Rejection at -----");
  console.log(promise);
  console.log("----- Reason -----");
  console.log(reason);
});

/*
The cache mechanism uses getbestblockhash to determine when to invalidate the cache
We can't ask for best block has on EVERY request since we can have 200 sim request.
therefor we store a promise to get best block hash, and that promise is blanked every 300 milliseconds
*/

let lastBestBlockHash = null;
let bestBlockHashPromise = null;
//unref so this timer alone never keeps the process alive
setInterval(() => {
  bestBlockHashPromise = null;
}, 300).unref();

const app = express();
app.use(cors());

//Default size limit for request are too small, increase it
app.use(express.json({ limit: "2mb" }));

const config = getConfig();

// Behind another reverse proxy (nginx, a load balancer) the client IP is in
// X-Forwarded-For; only honour it when the operator says so, otherwise any
// client could pick its own identity for the rate limiter.
if (config.trust_proxy) {
  app.set("trust proxy", config.trust_proxy);
}

// Per-IP limit and temporary ban for the depin* methods. The node limits per
// authenticated address; the origin IP only exists here.
const depinLimiter = createDepinLimiter({
  perMinute: config.depin_rate_limit === undefined ? 60 : Number(config.depin_rate_limit),
  banMinutes: config.depin_ban_minutes === undefined ? 60 : Number(config.depin_ban_minutes),
});
setInterval(() => depinLimiter.prune(Date.now()), 60 * 1000).unref();

//Default to concurrency 1
const queue = new PQueue({ concurrency: config.concurrency || 1 });

const port = config.local_port || process.env.PORT || 80;

app.use(express.json());

app.use(express.static("www"));

app.get("/whitelist", (req, res) => {
  res.send(whitelist);
  return;
});

app.get("/getCache", (_, res) => {
  const obj = {};

  obj.numberOfItemsInCache = cacheService.getKeys().length;

  // An example displaying the respective memory
  // usages in megabytes(MB)
  for (const [key, value] of Object.entries(process.memoryUsage())) {
    obj[key] = `Memory usage by ${key}, ${Math.round(value / 1000000)} MB `;
  }
  obj.queueSize = queue.size;
  obj.numberOfRequests = numberOfRequests.toLocaleString();
  obj.methods = cacheService.getMethods();
  obj.nodes = getNodes();
  obj.depinRateLimit = depinLimiter.stats();
  return res.send(obj);
});
app.get("/settings", (req, res) => {
  // Expose public parts of config. A Docker deployment does not have to know
  // its public hostname: when endpoint is unset, derive a usable browser URL
  // instead of leaking the internal service name (for example rpc-proxy).
  const configuredEndpoint =
    typeof config.endpoint === "string" ? config.endpoint.trim() : "";
  let configuredEndpointIsInternal = false;
  try {
    configuredEndpointIsInternal = ["rpc-proxy", "neuraid", "localhost", "127.0.0.1", "0.0.0.0"].includes(
      new URL(configuredEndpoint).hostname
    );
  } catch (_) {
    // An empty or malformed endpoint is handled by the public request URL.
    configuredEndpointIsInternal = true;
  }
  const endpoint =
    configuredEndpoint && !configuredEndpointIsInternal
      ? configuredEndpoint
      : `${req.protocol}://${req.get("host")}/rpc`;
  const obj = {
    heading: config.heading,
    environment: config.environment,
    endpoint,
  };
  res.send(obj);
});

app.get("/rpc", (req, res) => {
    res.status(405).set("Allow", "POST")
        .send({
            description:
            "Please use the HTTP POST method to proceed. For more details, refer to our documentation.",
        });
});
async function addToQueue(request, response) {
  async function work() {
    /*
                First off, already cached operations should NOT be queued, they should return immediately
                Start with naive implementation with duplicated code
        */

    const method = request.body.method;
    const params = request.body.params;

    cacheService.addMethod(method, new Date());
    let promise = null;

    const shouldCache = cacheService.shouldCache(method);

    if (shouldCache === true) {
      promise = cacheService.get(method, params);
      if (promise) {
        return promise
          .then((result) => {
            return response.send({ result });
          })
          .catch((error) => {
            return response.status(500).send({
              error,
            });
          });
      }
    }

    //OK the request was not already cached and handled
    try {
      if (shouldCache === true) {
        promise = cacheService.get(method, params);

        if (!promise) {
          const node = getRPCNode();
          const rpc = node.rpc;

          promise = rpc(method, params);

          //If promise fails, remove it from cache
          promise.catch((e) => {
            cacheService.remove(method, params);
            console.log("Removed", method, params, "from cache");
          });
          cacheService.put(method, params, promise);
        }
      }
      //Should NOT cache
      else {
        const node = getRPCNode();
        const rpc = node.rpc;
        promise = rpc(method, params);
      }
      // Return the HANDLED chain, not the raw promise. Returning `promise` here
      // leaked the rejection into p-queue, where nothing awaited it, so every
      // failing RPC produced an unhandledRejection that only the global handler
      // above caught. 0.5.x makes that far more frequent: JSON-RPC errors that
      // arrive with HTTP 200 used to resolve undefined and now reject.
      return promise
        .then((result) => {
          return response.send({ result });
        })
        .catch((error) => {
          // Handle checkdepinvalidity on non-DePIN assets gracefully.
          // The library rejects with {error, description} (JSON-RPC error, now
          // also on HTTP 200) or {statusText, status, description, error} — never
          // with a plain .message, so read every shape.
          const rpcErrorMessage = getRPCErrorMessage(error);
          if (method === 'checkdepinvalidity' && rpcErrorMessage.includes('must start with &')) {
            // Return a valid response indicating it's not a DePIN asset
            return response.send({
              result: {
                valid: false,
                isDePinAsset: false,
                message: 'Not a DePIN asset (assets must start with & to be DePIN assets)'
              }
            });
          }
          return response.status(500).send({
            error,
          });
        });
    } catch (e) {
      console.log("Error!", e);
      return Promise.resolve();
    }
  }
  //return it so the .catch() at the call site is real
  return queue.add(work);
}
app.post("/rpc", async (req, res) => {
  try {
    //check whitelist
    const method = req.body.method;
    const params = req.body.params;
    const inc = isWhitelisted(method, params);

    //Reset counter if too large
    if (numberOfRequests > Number.MAX_SAFE_INTEGER - 1000) {
      numberOfRequests = 0;
    }
    numberOfRequests++;

    if (inc === false) {
      console.log("Not whitelisted", method);
      return res.status(404).send({
        error: "Not in whitelist",
        description: "Method " + method + " is not supported",
      });
    }

    // DePIN abuse control by origin IP: over the limit, the IP is blocked for
    // a while and every depin* call answers 429 until it lapses.
    if (typeof method === "string" && method.startsWith("depin")) {
      const verdict = depinLimiter.check(req.ip, Date.now());
      if (!verdict.allowed) {
        if (verdict.justBanned) {
          console.log("DePIN rate limit exceeded, banning", req.ip, "for", depinLimiter.stats().banMinutes, "minutes");
        }
        res.set("Retry-After", String(verdict.retryAfterSeconds));
        return res.status(429).send({
          error: "Too many requests",
          description:
            "DePIN requests from this address are blocked for " +
            verdict.retryAfterSeconds +
            " seconds (limit: " +
            depinLimiter.stats().perMinute +
            " depin* requests per minute)",
        });
      }
    }
    //Special case for listaddressesforassets
    //Seems to be a bug with listaddressesforassets with second param totalCount set to true
    if (method === "listaddressesbyasset" && params && params.length >= 2) {
      if (params[1] === true) {
        return res.status(404).send({
          error: "Not in whitelist",
          description:
            "Method " +
            method +
            " with totalCount set to true is not whitelisted. Please use " +
            method +
            " without totalCount = true",
        });
      }
    }

    let p = bestBlockHashPromise; //need a reference if bestBlockHashPromise is set to null by interval
    if (!p) {
      const node = getRPCNode();
      const rpc = node.rpc;
      p = rpc(methods.getbestblockhash, []);

      bestBlockHashPromise = p;
    }

    //Clear cache if new best block hash
    const bestBlockHash = await p;
    if (bestBlockHash !== lastBestBlockHash) {
      cacheService.clear();
      lastBestBlockHash = bestBlockHash;
    }

    //Add RCP call to queue
    addToQueue(req, res).catch((e) => {
      console.log("Something went wrong", e);
    });
  } catch (e) {
    console.log("ERROR", e);
    console.dir(e);
    res.status(500).send({
      error: "Something went wrong, check your arguments",
    });
  }
});

// The /depin endpoint has been retired. It fronted the DePIN messaging gateway
// (raw TCP, port 19002) over HTTP, which never matched the gateway's protocol, and
// its signature flow was unrealizable: the client had to supply a signature before
// the single-use challenge it was meant to sign existed.
//
// Every depin* command is a regular node RPC served on the standard RPC port, so
// they go through POST /rpc like any other method. To publish a message use
// depinsubmitmsg with a payload already encrypted and signed by the client.
app.all("/depin", (req, res) => {
  res.status(410).send({
    error: "Gone",
    description:
      "The /depin endpoint has been removed. DePIN commands are regular node RPCs: " +
      "use POST /rpc. To send a message use depinsubmitmsg with a payload already " +
      "encrypted and signed client-side.",
  });
});

// Only listen when started as a program. Requiring this file (integration tests)
// gives you the configured Express app without binding a port.
if (require.main === module) {
  app.listen(port, () => {
    console.log(
      `RPC Proxy listening on path /rpc on port port ${port}, call me later`
    );
  });
}

module.exports = app;
