const { parse } = require("lossless-json");
const { parseRpcJson, rpcNumber } = require("@neuraiproject/neurai-rpc");

// Preserve the distinction between JSON numbers and strings. Unsafe numeric
// parameters must reach the node as exact JSON numbers, not quoted strings.
function parseRequestJson(text) {
  return parse(text, undefined, token => {
    const value = parseRpcJson(token);
    return typeof value === "string" ? rpcNumber(token) : value;
  });
}

module.exports = { parseRequestJson };
