import { exec } from "child_process";
import fs from "fs";

// Step 1: Update WizPay to point at new adapter
exec("npx hardhat run update_wizpay.mjs --network arc-testnet", (err, stdout, stderr) => {
  fs.writeFileSync("update_out.txt", `ERR: ${err ? err.code : 'null'}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`, "utf-8");
  console.log("Step 1 done (update WizPay)");

  // Step 2: Seed liquidity
  exec("npx hardhat run scripts/seed-liquidity-50.js --network arc-testnet", (err2, stdout2, stderr2) => {
    fs.writeFileSync("seed_out.txt", `ERR: ${err2 ? err2.code : 'null'}\nSTDOUT:\n${stdout2}\nSTDERR:\n${stderr2}`, "utf-8");
    console.log("Step 2 done (seed liquidity)");
  });
});
