import { exec } from "child_process";
import fs from "fs";

exec("npx hardhat run update_wizpay.mjs --network arc-testnet", (err, stdout, stderr) => {
  const output = `ERR: ${err ? err.code : 'null'}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
  fs.writeFileSync("update_out.txt", output, "utf-8");
  console.log("Done");
});
