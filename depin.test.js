const { isWhitelisted } = require("./whitelist");
const cacheService = require("./cacheService");
const { getRPCErrorMessage } = require("./rpcError");

/*
DePIN commands are regular node RPCs served on the standard RPC port, so they go
through /rpc and the whitelist like any other method. These tests pin down the
three decisions that are easy to regress:

  1. which depin* methods are exposed (anything needing the node's wallet is out)
  2. nothing derived from the message pool is cached (the cache follows blocks,
     the pool does not)
  3. the error message extractor copes with every shape the library rejects with
*/

describe("whitelist: DePIN methods that work without a wallet", () => {
  const exposed = [
    "depinchallenge",
    "depinclearmsg",
    "depingetmsginfo",
    "depinpoolstats",
    "depinmcpstatus",
    "depinreceivemsg",
    "depinlistsections",
    "depingetancestorrecipients",
    "depinsubmitmsg",
    "checkdepinvalidity",
    "listdepinholders",
    "listdepinaddresses",
    "getpubkey",
  ];

  test.each(exposed)("%s is whitelisted", (method) => {
    expect(isWhitelisted(method)).toBe(true);
  });
});

describe("whitelist: DePIN methods that need the node's wallet", () => {
  const rejected = [
    ["depingetmsg", "decrypts with the node's wallet keys"],
    ["depinsendmsg", "signs with a wallet address"],
    ["depinsignrequest", "signs a challenge request with the node's wallet keys"],
    ["depinsignchallenge", "signs a challenge with the node's wallet keys"],
    ["depindecrypt", "opens an encrypted reply with the node's wallet keys"],
    ["depinpoolpkey", "operator bootstrap of the service wallet"],
    ["listpqaddresses", "lists PQ addresses in the wallet"],
    ["depingetpoolcontent", "removed from the node: pool-wide metadata"],
  ];

  test.each(rejected)("%s is NOT whitelisted (%s)", (method) => {
    expect(isWhitelisted(method)).toBe(false);
  });
});

describe("whitelist: post-quantum key material is never exposed", () => {
  test.each(["dumpextkeypq", "exportxpqpub"])("%s is NOT whitelisted", (method) => {
    expect(isWhitelisted(method)).toBe(false);
  });
});

describe("cache: nothing derived from the message pool is cached", () => {
  // The cache is cleared when the best block hash changes, but pool state moves
  // independently of blocks — a cached entry would hide new messages until the
  // next block.
  const poolMethods = [
    "depinchallenge",
    "depinclearmsg",
    "depingetmsginfo",
    "depinpoolstats",
    "depinmcpstatus",
    "depinreceivemsg",
    "depinsubmitmsg",
  ];

  test.each(poolMethods)("%s is NOT cached", (method) => {
    expect(cacheService.shouldCache(method)).toBe(false);
  });

  test("depinlistsections is NOT cached: shouldCache cannot see the address argument", () => {
    // Without an address it is a per-tip view, but with the four-argument form
    // it returns per-section message counts encrypted for one address.
    // shouldCache() only receives the method name, so the safe answer for both
    // shapes is false.
    expect(cacheService.shouldCache("depinlistsections")).toBe(false);
  });
});

describe("cache: chain-derived DePIN queries stay cacheable", () => {
  test.each(["checkdepinvalidity", "listdepinholders", "listdepinaddresses"])(
    "%s is cached",
    (method) => {
      expect(cacheService.shouldCache(method)).toBe(true);
    }
  );
});

describe("getRPCErrorMessage", () => {
  test("JSON-RPC error object (the shape that used to resolve undefined on HTTP 200)", () => {
    const error = {
      error: { code: -8, message: "Asset name must start with &" },
      description: "Asset name must start with &",
    };
    expect(getRPCErrorMessage(error)).toBe("Asset name must start with &");
  });

  test("non-200 HTTP response", () => {
    const error = {
      statusText: "Internal Server Error",
      status: 500,
      description: "Method not found",
      error: { code: -32601, message: "Method not found" },
    };
    expect(getRPCErrorMessage(error)).toBe("Method not found");
  });

  test("unreachable node: error is a string, not an object", () => {
    const error = {
      originalError: new Error("connect ECONNREFUSED"),
      type: "ServerUnreachable",
      error: "Could not communicate with Neurai core node",
      description: "Are you sure that the URL is correct?",
    };
    expect(getRPCErrorMessage(error)).toBe(
      "Could not communicate with Neurai core node"
    );
  });

  test("falls back to description when error carries no message", () => {
    expect(getRPCErrorMessage({ error: {}, description: "boom" })).toBe("boom");
  });

  test("plain Error still works", () => {
    expect(getRPCErrorMessage(new Error("plain"))).toBe("plain");
  });

  test.each([[null], [undefined], [{}]])("returns '' for %p", (error) => {
    expect(getRPCErrorMessage(error)).toBe("");
  });

  test("a bare string is returned as-is", () => {
    expect(getRPCErrorMessage("just a string")).toBe("just a string");
  });
});
