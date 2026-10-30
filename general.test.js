const { isWhitelisted } = require("./whitelist");

test('Stop not whitelisted', () => {
    const result = isWhitelisted("stop");
    expect(result).toBe(false);
});


test('dumpprivkey not whitelisted', () => {
    const result = isWhitelisted("dumpprivkey");
    expect(result).toBe(false);
});

test("getblockcount IS whitelisted", () => {
    const result = isWhitelisted("getblockcount");
    expect(result).toBe(true);
});

test.each(["getprivacypoolinfo", "getprivacypoolupdates"])("%s IS whitelisted (privacy-pool history)", (method) => {
    expect(isWhitelisted(method)).toBe(true);
});

test.each([
  "getsilentpaymentindexinfo",
  "getsilentpaymenttweaks",
  "getsilentpaymenttweaksrange",
  "getchannelmessages",
  "getdistributionplan",
  "getdistributionproof",
  "getsnapshotannouncement",
])("%s IS whitelisted (bounded chain read)", (method) => {
  expect(isWhitelisted(method)).toBe(true);
});

test.each([
  "createdistributionbatch",
  "getdistributionbatches",
  "verifydistribution",
  "replaysnapshot",
  "getsnapshotrecipients",
  "opendepin",
  "closedepin",
  "sealdepin",
])("%s not whitelisted (payer side, wallet or unbounded)", (method) => {
  expect(isWhitelisted(method)).toBe(false);
});
