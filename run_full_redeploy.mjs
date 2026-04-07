import { exec } from "child_process";
import fs from "fs";

function runStep(cmd, label) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      const output = `${label}\nERR: ${err ? err.code : 'null'}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}\n`;
      console.log(output);
      if (err) reject(output);
      else resolve(stdout);
    });
  });
}

async function main() {
  // Step 1: Deploy
  console.log("=== STEP 1: Deploy ===");
  const deployOut = await runStep("npx hardhat run scripts/deploy-stablefx-adapter.js --network arc-testnet", "DEPLOY");
  
  // Extract new address
  const match = deployOut.match(/deployed to: (0x[a-fA-F0-9]{40})/);
  if (!match) { console.error("Could not find deployed address!"); process.exit(1); }
  const newAddr = match[1];
  console.log("New Address:", newAddr);
  
  // Step 2: Update WizPay to point at new adapter
  // Write a temp script with the new address
  const updateScript = `
import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();
async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const wizpay = await hre.ethers.getContractAt("WizPay", "0x87ACE45582f45cC81AC1E627E875AE84cbd75946");
    const tx = await wizpay.updateFXEngine("${newAddr}");
    await tx.wait();
    console.log("WizPay fxEngine updated to:", await wizpay.fxEngine());
}
main().catch(e => { console.error(e); process.exit(1); });
`;
  fs.writeFileSync("_tmp_update.mjs", updateScript, "utf-8");
  
  console.log("=== STEP 2: Update WizPay ===");
  await runStep("npx hardhat run _tmp_update.mjs --network arc-testnet", "UPDATE");
  
  // Step 3: Seed liquidity
  // Update seed script address
  let seedContent = fs.readFileSync("scripts/seed-liquidity-50.js", "utf-8");
  seedContent = seedContent.replace(/const STABLEFX_ADAPTER_ADDRESS = "0x[a-fA-F0-9]{40}"/, `const STABLEFX_ADAPTER_ADDRESS = "${newAddr}"`);
  fs.writeFileSync("scripts/seed-liquidity-50.js", seedContent, "utf-8");
  
  console.log("=== STEP 3: Seed Liquidity ===");
  await runStep("npx hardhat run scripts/seed-liquidity-50.js --network arc-testnet", "SEED");
  
  // Step 4: Update frontend address
  let addrContent = fs.readFileSync("frontend/constants/addresses.ts", "utf-8");
  addrContent = addrContent.replace(/export const STABLE_FX_ADAPTER_ADDRESS =\s*"0x[a-fA-F0-9]{40}"/, `export const STABLE_FX_ADAPTER_ADDRESS =\n  "${newAddr}"`);
  fs.writeFileSync("frontend/constants/addresses.ts", addrContent, "utf-8");
  
  // Step 5: Extract fresh ABI
  console.log("=== STEP 4: Extract ABI ===");
  await runStep("node extract_abi.cjs", "ABI");
  
  console.log("\\n🎉 ALL DONE! New adapter:", newAddr);
  console.log("Add to .env: STABLEFX_ADAPTER_ADDRESS=" + newAddr);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
