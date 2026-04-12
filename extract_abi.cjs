const fs = require("fs");
const path = require("path");

const artifactPath = path.join(__dirname, "artifacts", "contracts", "StableFXAdapter_V2.sol", "StableFXAdapter_V2.json");
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

const fileContent = `export const STABLE_FX_ADAPTER_ABI = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`;

fs.writeFileSync(path.join(__dirname, "frontend", "constants", "stablefx-abi.ts"), fileContent, "utf-8");
console.log("ABI isolated and copied directly!");
