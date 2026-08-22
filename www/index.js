const settingsPromise = fetch("/settings").then((response) => {
  if (!response.ok) throw new Error("Could not load RPC settings");
  return response.json();
});

function rpcCurl(endpoint) {
  return `curl -sS -X POST '${endpoint}' \\
  -H 'Content-Type: application/json' \\
  --data '{"method":"getblockcount","params":[]}'`;
}

function rpcFetch(endpoint) {
  return `const response = await fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ method: "getblockcount", params: [] })
});

const { result } = await response.json();
console.log(result);`;
}

// DePIN examples. The four snippets form one sequence and share the rpc()
// helper defined in the first one; the pool root and sections are the example
// hierarchy &NEWS > &NEWS/GENERAL > &NEWS/GENERAL/SPORT.
function depinDiscover(endpoint) {
  return `const ENDPOINT = "${endpoint}";
async function rpc(method, params = []) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params })
  });
  const { result, error, description } = await res.json();
  if (!res.ok || error) throw new Error(description || error);
  return result;
}

// Pool identity: root token, protocol and the pool key to pin.
// Replies not bound to an address are { body: "<hex JSON>", poolsig }.
const info = await rpc("depingetmsginfo");
const pool = JSON.parse(hexToUtf8(info.body));
// { token: "&NEWS", protocol: 2, depinpoolpkey: "02ab…", maxrecipients: 20, … }

// Section names are public chain data: no authentication needed
const { sections } = JSON.parse(hexToUtf8((await rpc("depinlistsections")).body));
// [{ name: "&NEWS",         label: "",              depth: 0 },
//  { name: "&NEWS/GENERAL", label: "GENERAL",       depth: 1 },
//  { name: "&NEWS/GENERAL/SPORT", label: "GENERAL/SPORT", depth: 2 }]`;
}

function depinAuth() {
  return `const TOKEN = "&NEWS/GENERAL";   // the section to read: the challenge is bound to it
const ADDRESS = "NX…";           // holder of &NEWS/GENERAL (or of &NEWS), key revealed on chain

// 1. Sign the request itself, so nobody can ask in your name
const ts = Date.now();                                   // milliseconds, within 60 s of the node
const reqSig = signMessage(holderKey, \`DEPIN-REQ|receive|\${TOKEN}|\${ADDRESS}|\${ts}\`);
const reply = await rpc("depinchallenge", [TOKEN, ADDRESS, ts, reqSig]);
// { encrypted, poolsig } — verify poolsig with the pinned pool key, then open it
const { challenge } = decryptForAddress(holderKey, reply.encrypted);   // single use, 30 s

// 2. Sign the nonce: this pair authenticates the next call
const sig = signMessage(holderKey, \`DEPIN-GET|\${TOKEN}|\${ADDRESS}|\${challenge}\`);`;
}

function depinRead() {
  return `// Messages of &NEWS/GENERAL and its children, oldest first, 25 per page
const reply = await rpc("depinreceivemsg", [TOKEN, ADDRESS, challenge, sig, 0, "", 25]);
const page = decryptForAddress(holderKey, reply.encrypted);
// { messages: [{ hash, token: "&NEWS/GENERAL/SPORT", sender, timestamp,
//                message_type: "group", encrypted_payload_hex, signature_hex }],
//   has_more, next_challenge, next_expires_in: 300 }

// Keep reading without calling depinchallenge again: sign next_challenge
const next = page.next_challenge;
const nextSig = signMessage(holderKey, \`DEPIN-GET|\${TOKEN}|\${ADDRESS}|\${next}\`);
const last = page.messages.at(-1)?.hash ?? "";
const more = await rpc("depinreceivemsg", [TOKEN, ADDRESS, next, nextSig, 0, last, 25]);

// The same pair also answers "my tabs": access and counters limited to the
// subtree you hold (a holder of GENERAL sees GENERAL and SPORT, not OTHERS)
// await rpc("depinlistsections", [ADDRESS, TOKEN, next, nextSig]);`;
}

function depinPublish() {
  return `const SECTION = "&NEWS/GENERAL/SPORT";

// Recipients: active holders of SPORT and of its ancestors up to the pool
// root, with their revealed keys. Refuse to send if the set was truncated.
const recipients = await rpc("depingetancestorrecipients", [SECTION, 50, pool.token]);
if (recipients.truncated) throw new Error("too many recipients for one message");

// Build the message client-side: encrypt once, wrap the content key for each
// recipient, sign the message hash with the sender's key
const message = buildDepinMessage({
  token: SECTION, sender: ADDRESS, recipients,
  text: "Kick-off at 18:00", key: holderKey
});

// Wrap the serialized message in an ECIES envelope for the pinned pool key
const envelope = eciesEncrypt(pool.depinpoolpkey, message.hex);
await rpc("depinsubmitmsg", [{ sender: ADDRESS, encrypted: envelope }]);
// The node opens the envelope, checks sender and signature, verifies the
// sender's access to SPORT and stores the message. It never reads the text.`;
}

async function copyElement(targetId, button) {
  const text = document.getElementById(targetId)?.textContent || "";
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => { button.textContent = original; }, 1200);
  } catch (_) {
    button.textContent = "Copy failed";
  }
}

async function initialiseSettings() {
  const settings = await settingsPromise;
  const endpoint = settings.endpoint;

  document.title = `${settings.environment || "Neurai"} RPC`;
  document.querySelectorAll("[data-setting]").forEach((element) => {
    element.textContent = settings[element.dataset.setting] || "Neurai";
  });
  document.getElementById("endpoint").textContent = endpoint;
  document.getElementById("rpcCurl").textContent = rpcCurl(endpoint);
  document.getElementById("rpcFetch").textContent = rpcFetch(endpoint);
  document.getElementById("depinDiscover").textContent = depinDiscover(endpoint);
  document.getElementById("depinAuth").textContent = depinAuth();
  document.getElementById("depinRead").textContent = depinRead();
  document.getElementById("depinPublish").textContent = depinPublish();
}

async function initialiseMethodExplorer() {
  const select = document.getElementById("procedureSelect");
  const help = document.getElementById("help");
  const response = await fetch("/whitelist");
  const methods = await response.json();

  methods.forEach((method) => {
    if (method.startsWith("==")) return;
    const option = document.createElement("option");
    option.value = method;
    option.textContent = method;
    select.appendChild(option);
  });

  select.addEventListener("change", async () => {
    if (!select.value) {
      help.textContent = "Select a method to view its node help.";
      return;
    }
    help.textContent = "Loading node help…";
    try {
      const result = await fetch("/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "help", params: [select.value] }),
      });
      const body = await result.json();
      help.textContent = body.result || body.description || "No help returned.";
    } catch (_) {
      help.textContent = "Could not retrieve method help from the node.";
    }
  });
}

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", () => copyElement(button.dataset.copyTarget, button));
});

const yearElement = document.getElementById("year");
if (yearElement) yearElement.textContent = String(new Date().getFullYear());

const themeToggle = document.getElementById("themeToggle");
const preferredTheme = localStorage.getItem("neurai-rpc-theme") || "light";
document.documentElement.dataset.theme = preferredTheme;
themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("neurai-rpc-theme", nextTheme);
});

initialiseSettings().catch(() => {
  document.getElementById("endpoint").textContent = "Settings unavailable";
});
initialiseMethodExplorer().catch(() => {
  document.getElementById("help").textContent = "The method explorer is unavailable.";
});
