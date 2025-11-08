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
        "endpoint": "https://rpc-main.neurai.org/rpc",
        "environment": "Neurai",
        "local_port": 19999,
        "nodes": [
          {
            "name": "Node number 1",
            "username": "dauser",
            "password": "dapassword",
            "neurai_url": "http://localhost:19101"
          },
          {
            "name": "Node number 2", 
            "neurai_url": "http://localhost:19111",
            "password": "secret",
            "username": "secret"
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
