

//Cache service
const cacheService = require("./cacheService");

test('getrawmempool should NOT be cached', () => { 

    const method = "getrawmempool";
    const shouldCache = cacheService.shouldCache(method)
    expect(shouldCache).toBe(false);
  });
test.each(["getdistributionplan", "getdistributionproof", "getsnapshotannouncement", "getsilentpaymenttweaks"])(
  "%s is cached until the next block",
  (method) => {
    expect(cacheService.shouldCache(method)).toBe(true);
  }
);

test.each(["getsilentpaymenttweaksrange", "getchannelmessages"])("%s is NOT cached (large answers)", (method) => {
  expect(cacheService.shouldCache(method)).toBe(false);
});
