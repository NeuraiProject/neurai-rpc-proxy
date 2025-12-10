const { methods } = require("@neuraiproject/neurai-rpc");
const { getRPCNode, getNodes, getDePinNode, getDePinNodes } = require("./getRPCNode");
const { default: PQueue } = require("p-queue"); //NOTE version 6 with support for CommonJS
const process = require("process"); //to get memory used
const cacheService = require("./cacheService");
const depinService = require("./depinService");
const cors = require("cors");
const express = require("express");
const getConfig = require("./getConfig");
const { whitelist, isWhitelisted } = require("./whitelist");

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
setInterval(() => {
  bestBlockHashPromise = null;
}, 300);

const app = express();
app.use(cors());

//Default size limit for request are too small, increase it
app.use(express.json({ limit: "2mb" }));

const config = getConfig();

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
  obj.depinChallenges = depinService.getCacheStats();
  const nodes = getNodes();
  const depinNodes = getDePinNodes();

  obj.nodes = nodes;
  obj.depinNodes = depinNodes;
  return res.send(obj);
});
app.get("/settings", (req, res) => {
  //Expose public parts of config
  const obj = {
    heading: config.heading,
    environment: config.environment,
    endpoint: config.endpoint,
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
      promise
        .then((result) => {
          return response.send({ result });
        })
        .catch((error) => {
          return response.status(500).send({
            error,
          });
        });
      return promise;
    } catch (e) {
      console.log("Error!", e);
      return Promise.resolve();
    }
  }
  queue.add(work);
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

app.post("/depin", async (req, res) => {
  try {
    const { address, signature, method, params } = req.body;

    // Validate required fields
    if (!address || typeof address !== 'string') {
      return res.status(400).send({
        error: "Missing or invalid address",
        description: "Request must include a valid 'address' field",
      });
    }

    if (!signature || typeof signature !== 'string') {
      return res.status(400).send({
        error: "Missing or invalid signature",
        description: "Request must include a valid 'signature' field (base64-encoded)",
      });
    }

    if (!method || typeof method !== 'string') {
      return res.status(400).send({
        error: "Missing or invalid method",
        description: "Request must include a valid 'method' field",
      });
    }

    if (!Array.isArray(params)) {
      return res.status(400).send({
        error: "Missing or invalid params",
        description: "Request must include a 'params' array",
      });
    }

    // Check whitelist
    if (!isWhitelisted(method, params)) {
      console.log("DePIN: Not whitelisted", method);
      return res.status(404).send({
        error: "Not in whitelist",
        description: "Method " + method + " is not supported",
      });
    }

    // Get active DePIN node
    const depinNode = getDePinNode();
    const depinUrl = depinNode.depinUrl;

    // Create a signature verification function
    // In this proxy mode, the signature is already provided by the client
    const signMessage = async (challenge) => signature;

    // Execute DePIN RPC call
    const result = await depinService.executeDePinRPC(
      depinUrl,
      address,
      signMessage,
      method,
      params
    );

    // Reset counter if too large
    if (numberOfRequests > Number.MAX_SAFE_INTEGER - 1000) {
      numberOfRequests = 0;
    }
    numberOfRequests++;

    return res.send({ result });
  } catch (e) {
    console.log("DePIN ERROR", e);
    return res.status(500).send({
      error: e.message || "Something went wrong with DePIN request",
    });
  }
});

app.listen(port, () => {
  console.log(
    `RPC Proxy listening on path /rpc on port port ${port}, call me later`
  );
});
