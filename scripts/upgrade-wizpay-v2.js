import hre from "hardhat";
import fs from "fs";
import path from "path";

const { ethers } = hre;

const ARC_CONTRACTS = {
  previousWizPay: "0xE89f7c3781Dd24baE53d6ef9Af8a6a174731b4c8",
  mockFxEngine: "0xCbaf97B317A9cAAAE27c3d8deD48d845C4064C32",
  USDC: "0x3600000000000000000000000000000000000000",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  USYC: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const feeCollector = process.env.FEE_COLLECTOR || deployer.address;
  const feeBps = Number(process.env.FEE_BPS || 10);

  console.log("Deploying WizPay v2 from:", deployer.address);
  console.log("MockFXEngine:", ARC_CONTRACTS.mockFxEngine);
  console.log("Previous WizPay:", ARC_CONTRACTS.previousWizPay);

  const WizPay = await ethers.getContractFactory("WizPay");
  const wizPay = await WizPay.deploy(
    ARC_CONTRACTS.mockFxEngine,
    feeCollector,
    feeBps
  );

  await wizPay.waitForDeployment();

  const deploymentTx = wizPay.deploymentTransaction();
  const deploymentReceipt = deploymentTx ? await deploymentTx.wait() : null;
  const wizPayAddress = await wizPay.getAddress();

  await wizPay.batchSetTokenWhitelist(
    [ARC_CONTRACTS.USDC, ARC_CONTRACTS.EURC, ARC_CONTRACTS.USYC],
    true
  );

  const deploymentInfo = {
    network: "arc-testnet",
    chainId: 5042002,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    previousWizPay: ARC_CONTRACTS.previousWizPay,
    contracts: {
      WizPay: wizPayAddress,
      MockFXEngine: ARC_CONTRACTS.mockFxEngine,
      RealUSDC: ARC_CONTRACTS.USDC,
      RealEURC: ARC_CONTRACTS.EURC,
      RealUSYC: ARC_CONTRACTS.USYC,
    },
    config: {
      feeBps: feeBps.toString(),
      feeCollector,
      whitelistEnabled: false,
    },
    deployment: {
      blockNumber: deploymentReceipt?.blockNumber?.toString() ?? null,
      transactionHash: deploymentReceipt?.hash ?? deploymentTx?.hash ?? null,
    },
  };

  const deploymentsDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentsDir, "arc-testnet-wizpay-v2.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("WizPay v2 deployed to:", wizPayAddress);
  console.log("Deployment block:", deploymentInfo.deployment.blockNumber);
  console.log("Deployment tx:", deploymentInfo.deployment.transactionHash);
  console.log("Saved:", path.join(deploymentsDir, "arc-testnet-wizpay-v2.json"));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Upgrade failed:", error);
    process.exit(1);
  });
