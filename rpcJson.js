const { parse, LosslessNumber } = require('lossless-json');
const { parseRpcJson, isDepinRemoteMethod, assertNoDuplicateJsonKeys } = require('@neuraiproject/neurai-rpc');
function rejectNumericImpersonation(_key, value) {
  if (value && typeof value === 'object' && value.isLosslessNumber === true && !(value instanceof LosslessNumber))
    throw new TypeError('Invalid numeric object');
  return value;
}
// Ordinary RPC compatibility keeps safe numbers. Signed DePIN requests also
// preserve lexical integer tokens so a relay cannot normalize invalid input.
function parseRequestJson(text) {
  assertNoDuplicateJsonKeys(text);
  const value = parse(text, rejectNumericImpersonation, (token) => {
    const numeric = parseRpcJson(token);
    return typeof numeric === 'string' ? new LosslessNumber(token) : numeric;
  });
  return isDepinRemoteMethod(value?.method) ? parse(text, rejectNumericImpersonation) : value;
}
module.exports = { parseRequestJson };
