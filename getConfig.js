function getConfig() {
  try {
    const config = require("./config.json");
    return config;
  } catch (e) {
    console.log("Could not find config.json");
    console.log("Please create a config.json file");

    const template = `
    {
        "concurrency": 4,
        "endpoint": "https://rpc.neurai.org/rpc",
        "environment": "Neurai",
        "local_port": 19999,
        "nodes": [
          {
            "name": "Node 1",
            "username": "dauser",
            "password": "dapassword",
            "neurai_url": "http://localhost:20001"
          },
          {
            "name": "Node 2", 
            "password": "secret",
            "username": "secret",
            "neurai_url": "http://localhost:19001"
          }
        ]
      }
      `;

    console.log("Example content of config.json");
    console.info(template);

    process.exit(1);
  }
}

module.exports = getConfig;
