/*
Extract a human readable message from whatever @neuraiproject/neurai-rpc rejects with.

The library never rejects with a plain Error, so `error.message` is almost always
undefined. It uses three shapes:

  1. {error: {code, message}, description}      JSON-RPC error, including the ones
                                                that arrive with HTTP 200 (these
                                                resolved to undefined before 0.5.0)
  2. {statusText, status, description, error}   non-200 HTTP response
  3. {originalError, type, error, description}  node unreachable ("ServerUnreachable")

In shape 3 `error` is a string, in shapes 1 and 2 it is an object (or null).
*/
function getRPCErrorMessage(error) {
  if (!error) {
    return "";
  }
  if (typeof error === "string") {
    return error;
  }

  const candidates = [
    error.error && error.error.message,
    typeof error.error === "string" ? error.error : null,
    error.description,
    error.message,
    error.statusText,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }
  return "";
}

module.exports = { getRPCErrorMessage };
