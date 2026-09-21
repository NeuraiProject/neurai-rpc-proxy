const http = require("node:http");

/*
Integration tests: these drive the real Express app in index.js over HTTP against a
fake Neurai node, so they cover behaviour unit tests cannot reach, above all that a
JSON-RPC error arriving with HTTP 200 comes out as 500 on /rpc.

That is the behaviour change in @neuraiproject/neurai-rpc 0.5.0: getRPC used to
resolve undefined for those, silently swallowing the error, so the proxy answered
200 {"result":null}. It must reject now.
*/

let fakeNode;
let fakeNodeRequests;
let fakeNodeRawRequests;
let proxyServer;
let proxyUrl;

// What the fake node answers for a given method. Each entry is
// {status, body} and body is sent verbatim as JSON.
let nodeResponses;

function startFakeNode() {
  return new Promise((resolve) => {
    fakeNode = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        fakeNodeRawRequests.push(raw);
        const parsed = JSON.parse(raw);
        fakeNodeRequests.push(parsed);

        const canned = nodeResponses[parsed.method] || {
          status: 200,
          body: { result: null, error: null, id: parsed.id },
        };
        res.writeHead(canned.status, { "Content-Type": "application/json" });
        res.end(canned.rawBody ?? JSON.stringify({ id: parsed.id, ...canned.body }));
      });
    });
    fakeNode.listen(0, "127.0.0.1", () => resolve(fakeNode.address().port));
  });
}

beforeAll(async () => {
  fakeNodeRequests = [];
  fakeNodeRawRequests = [];
  nodeResponses = {
    // Every /rpc call is preceded by a getbestblockhash to drive cache invalidation
    getbestblockhash: { status: 200, body: { result: "aaaa", error: null } },
  };

  const nodePort = await startFakeNode();

  // index.js reads config.json through getConfig; point it at the fake node
  // instead of requiring a real config.json on disk.
  jest.doMock("./getConfig", () => () => ({
    concurrency: 4,
    endpoint: "http://rpc-proxy:19999/rpc",
    environment: "integration test",
    heading: "integration test",
    local_port: 0,
    nodes: [
      {
        name: "fake-node",
        username: "u",
        password: "p",
        neurai_url: `http://127.0.0.1:${nodePort}`,
      },
    ],
  }));

  const app = require("./index");

  await new Promise((resolve) => {
    proxyServer = app.listen(0, "127.0.0.1", resolve);
  });
  proxyUrl = `http://127.0.0.1:${proxyServer.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => proxyServer.close(resolve));
  await new Promise((resolve) => fakeNode.close(resolve));
});

function post(path, body) {
  return fetch(`${proxyUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /settings", () => {
  test("does not expose a Docker-internal endpoint to browser clients", async () => {
    const response = await fetch(`${proxyUrl}/settings`);
    expect(response.status).toBe(200);
    expect((await response.json()).endpoint).toBe(`${proxyUrl}/rpc`);
  });
});

describe("POST /rpc error handling", () => {
  test("a JSON-RPC error arriving with HTTP 200 becomes a 500", async () => {
    // The regression this guards: before 0.5.0 getRPC resolved undefined here and
    // the proxy answered 200 {"result":null}.
    nodeResponses.getrawmempool = {
      status: 200,
      body: { result: null, error: { code: -8, message: "boom on http 200" } },
    };

    const response = await post("/rpc", { method: "getrawmempool", params: [] });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(JSON.stringify(body)).toMatch(/boom on http 200/);
  });

  test("a failing RPC does not leak an unhandled rejection", async () => {
    // Regression: work() used to return the raw rejected promise instead of the
    // chain that handles it, so p-queue was left holding a rejection nobody
    // awaited. Only the global unhandledRejection handler caught it.
    nodeResponses.getrawmempool = {
      status: 500,
      body: { error: { code: -1, message: "node exploded" } },
    };

    const leaked = [];
    const onUnhandled = (reason) => leaked.push(reason);
    process.on("unhandledRejection", onUnhandled);

    try {
      const response = await post("/rpc", { method: "getrawmempool", params: [] });
      expect(response.status).toBe(500);
      // give the microtask queue a chance to surface a stray rejection
      await new Promise((resolve) => setTimeout(resolve, 50));
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }

    expect(leaked).toEqual([]);
  });

  test("a successful call still returns 200 with the result", async () => {
    nodeResponses.getblockcount = {
      status: 200,
      body: { result: 12345, error: null },
    };

    const response = await post("/rpc", { method: "getblockcount", params: [] });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: 12345 });
  });

  test("a non-whitelisted method is rejected without touching the node", async () => {
    const before = fakeNodeRequests.filter((r) => r.method === "depinsendmsg").length;

    const response = await post("/rpc", { method: "depinsendmsg", params: [] });

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Not in whitelist");
    expect(fakeNodeRequests.filter((r) => r.method === "depinsendmsg").length).toBe(
      before
    );
  });

  test("a whitelisted DePIN method does reach the node", async () => {
    nodeResponses.depinlistsections = {
      status: 200,
      body: { result: [{ name: "&TOKEN/GENERAL", label: "GENERAL", depth: 1 }], error: null },
    };

    const response = await post("/rpc", { method: "depinlistsections", params: [] });

    expect(response.status).toBe(200);
    expect(fakeNodeRequests.some((r) => r.method === "depinlistsections")).toBe(true);
  });
});

describe("GET /getCache no longer reports DePIN gateway state", () => {
  test("depinChallenges and depinNodes are gone", async () => {
    const body = await (await fetch(`${proxyUrl}/getCache`)).json();

    expect(body.depinChallenges).toBeUndefined();
    expect(body.depinNodes).toBeUndefined();
    expect(Array.isArray(body.nodes)).toBe(true);
  });
});


describe("exact RPC amounts", () => {
  test("preserves large XNA and asset responses on cache misses and hits", async () => {
    nodeResponses.getaddressbalance = {
      status: 200,
      rawBody: '{"result":[{"assetName":"XNA","balance":9007199254740993},{"assetName":"BIG","balance":10000000000000001}],"error":null}',
    };
    const before = fakeNodeRequests.filter(r => r.method === "getaddressbalance").length;
    for (let i = 0; i < 2; i++) {
      const response = await post("/rpc", { method: "getaddressbalance", params: [{ addresses: ["large-fixture"] }, true] });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ result: [
        { assetName: "XNA", balance: "9007199254740993" },
        { assetName: "BIG", balance: "10000000000000001" },
      ] });
    }
    expect(fakeNodeRequests.filter(r => r.method === "getaddressbalance").length - before).toBe(1);
  });

  test("preserves fractional asset supply and negative mempool deltas", async () => {
    nodeResponses.getassetdata = { status: 200, rawBody: '{"result":{"amount":100000000.00000001,"units":8}}' };
    nodeResponses.getaddressmempool = { status: 200, rawBody: '{"result":[{"satoshis":-9007199254740993},{"satoshis":1}]}' };
    expect(await (await post("/rpc", { method: "getassetdata", params: ["BIG"] })).json()).toEqual({ result: { amount: "100000000.00000001", units: 8 } });
    expect(await (await post("/rpc", { method: "getaddressmempool", params: [{ addresses: ["large-fixture"] }] })).json()).toEqual({ result: [{ satoshis: "-9007199254740993" }, { satoshis: 1 }] });
  });

  test("forwards original numeric tokens, including nested and exponent forms", async () => {
    const params = '[[],{"address":100000000.00000001,"nested":[9007199254740993,-9007199254740993,1e20,"9007199254740993"]}]';
    const response = await fetch(`${proxyUrl}/rpc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: `{"method":"createrawtransaction","params":${params}}` });
    expect(response.status).toBe(200);
    const raw = fakeNodeRawRequests.findLast(r => r.includes('"method":"createrawtransaction"'));
    expect(raw).toContain(`"params":${params}`);
  });

  test("cache keys distinguish adjacent unsafe integers and quoted strings", async () => {
    const before = fakeNodeRequests.filter(r => r.method === "getblockhash").length;
    for (const token of ['9007199254740992', '9007199254740993', '"9007199254740993"', '9007199254740993']) {
      const response = await fetch(`${proxyUrl}/rpc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: `{"method":"getblockhash","params":[${token}]}` });
      expect(response.status).toBe(200);
    }
    expect(fakeNodeRequests.filter(r => r.method === "getblockhash").length - before).toBe(3);
  });

  test("malformed JSON returns 400 and never reaches the node", async () => {
    const before = fakeNodeRequests.length;
    const response = await fetch(`${proxyUrl}/rpc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"method":"getblockcount","params":[NaN]}' });
    expect(response.status).toBe(400);
    expect(fakeNodeRequests.length).toBe(before);
  });
});
