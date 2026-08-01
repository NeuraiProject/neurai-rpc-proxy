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