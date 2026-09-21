const { parseRequestJson } = require('./rpcJson');
const { stringifyRpcJson } = require('@neuraiproject/neurai-rpc');

test('request codec preserves nested numbers without coercing strings', () => {
  const text = '{"params":[9007199254740993,100000000.00000001,-9007199254740993,1e20,"9007199254740993",1,true,null]}';
  expect(stringifyRpcJson(parseRequestJson(text))).toBe(text);
});

test('safe request parameters retain their primitive types', () => {
  expect(parseRequestJson('{"params":[1,0.5,true,"value",null]}')).toEqual({ params: [1, 0.5, true, 'value', null] });
});
