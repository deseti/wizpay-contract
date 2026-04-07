import hre from "hardhat";
import fs from "fs";
import path from "path";

const { ethers } = hre;

const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
];

const RECIPIENTS = [
  "0x0000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000002",
];

async function main() {
  const deploymentPath = path.join(
    process.cwd(),
    "deployments",
    "arc-testnet-wizpay-v2.json"
  );

  if (!fs.existsSync(deploymentPath)) {
    throw new Error("Missing deployments/arc-testnet-wizpay-v2.json");
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const wizPayAddress = deployment.contracts.WizPay;
  const usdcAddress = deployment.contracts.RealUSDC;
  const eurcAddress = deployment.contracts.RealEURC;

  const [deployer] = await ethers.getSigners();
  const usdc = new ethers.Contract(usdcAddress, ERC20_ABI, deployer);
  const wizPay = await ethers.getContractAt("WizPay", wizPayAddress);

  const tokenOuts = [usdcAddress, eurcAddress];
  const amountsIn = [
    ethers.parseUnits("0.05", 6),
    ethers.parseUnits("0.05", 6),
  ];

  console.log("Verifying WizPay v2 with mixed batch routing...");
  console.log("WizPay:", wizPayAddress);

  const totalAmount = amountsIn.reduce((sum, amount) => sum + amount, 0n);
  await (await usdc.approve(wizPayAddress, totalAmount)).wait();

  const [estimatedAmountsOut] = await wizPay.getBatchEstimatedOutputs(
    usdcAddress,
    tokenOuts,
    amountsIn
  );

  const minAmountsOut = estimatedAmountsOut.map(
    (estimate) => (estimate * 98n) / 100n
  );

  const tx = await wizPay
    .connect(deployer)
    ["batchRouteAndPay(address,address[],address[],uint256[],uint256[],string)"](
      usdcAddress,
      tokenOuts,
      RECIPIENTS,
      amountsIn,
      minAmountsOut,
      `LIVE-CHECK-${Date.now()}`
    );

  const receipt = await tx.wait();

  console.log("Success tx:", tx.hash);
  console.log("Block:", receipt.blockNumber.toString());
  console.log("Gas used:", receipt.gasUsed.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Live verification failed:", error);
    process.exit(1);
  });
