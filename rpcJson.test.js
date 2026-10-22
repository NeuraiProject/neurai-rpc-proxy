const { parseRequestJson } = require('./rpcJson');
const { stringifyRpcJson } = require('@neuraiproject/neurai-rpc');

test('request codec preserves nested numbers without coercing strings', () => {
  const text = '{"params":[9007199254740993,100000000.00000001,-9007199254740993,1e20,"9007199254740993",1,true,null]}';
  expect(stringifyRpcJson(parseRequestJson(text))).toBe(text);
});

test('safe request parameters retain their primitive types', () => {
  expect(parseRequestJson('{"params":[1,0.5,true,"value",null]}')).toEqual({ params: [1, 0.5, true, 'value', null] });
});

test('signed DePIN parameters retain lexical numbers and reject duplicates/impostors', () => {
  const text = '{"method":"depinreceiveseq","params":[{"protocol":5,"timestamp_ms":1e3,"args":{"cursor":{"after_seq":9007199254740993}}}]}';
  expect(stringifyRpcJson(parseRequestJson(text))).toBe(text);
  expect(() => parseRequestJson('{"method":"depinreceiveseq","params":[{"protocol":5,"protocol":4}]}')).toThrow(/Duplicate/);
  expect(() => parseRequestJson('{"method":"depinreceiveseq","params":[{"protocol":{"isLosslessNumber":true,"value":"5"}}]}')).toThrow(
    /numeric object/,
  );
});

test('equal duplicate DePIN fields are rejected before forwarding',()=>{
 expect(()=>parseRequestJson('{"method":"depinreceiveseq","params":[{"protocol":5,"protocol":5}]}')).toThrow(/Duplicate/);
});
