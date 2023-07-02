const { getRPC, methods } = require("@neuraiproject/neurai-rpc");
//@neuraiproject/neurai-rpc believes that username/password is mandatory,
//so just send in whatever
const username ="whatever";
const password ="whatever"; 
//Check the ENDPOINT URL, "https://xna-rpc-testnet.ting.finance/rpc" or "https://xna-rpc-mainnet.ting.finance/rpc"
const rpc = getRPC(username, password, "https://rpc-mainnet.neurai.org/rpc");

const promise = rpc(methods.getassetdata, ["UGLY"]);
promise.catch((e) => {
    console.dir(e);
});

promise.then((response) => {    
        console.log(response);
});