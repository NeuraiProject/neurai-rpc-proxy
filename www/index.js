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

function depinExample(endpoint) {
  return `fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    method: "depinlistsections",
    params: []
  })
});`;
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
  document.getElementById("depinExample").textContent = depinExample(endpoint);
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
