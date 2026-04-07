import hre from "hardhat";
const { ethers } = hre;

/**
 * Deployment script for WizPay on ARC Testnet
 * 
 * Usage:
 * 1. Setup .env file with PRIVATE_KEY
 * 2. Get testnet USDC from https://faucet.circle.com
 * 3. Run: npx hardhat run scripts/deploy-wizpay.js --network arc-testnet --config hardhat.config.arc.js
 */

// ARC Testnet Contract Addresses
const ARC_CONTRACTS = {
  USDC: "0x3600000000000000000000000000000000000000",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  USYC: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C",
  STABLEFX_ESCROW: "0x1f91886C7028986aD885ffCee0e40b75C9cd5aC1",
  PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
};

async function main() {
  console.log("🚀 Deploying WizPay to ARC Testnet...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);

  // Check USDC balance (gas token on ARC)
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatUnits(balance, 18), "USDC\n");

  if (balance === 0n) {
    console.error("❌ Insufficient USDC for gas fees!");
    console.log("Get testnet USDC from: https://faucet.circle.com\n");
    process.exit(1);
  }

  // Step 1: Deploy MockFXEngine (for testing)
  console.log("📦 Deploying MockFXEngine...");
  const MockFXEngine = await ethers.getContractFactory("MockFXEngine");
  const mockFxEngine = await MockFXEngine.deploy();
  await mockFxEngine.waitForDeployment();
  const fxEngineAddress = await mockFxEngine.getAddress();
  console.log("✅ MockFXEngine deployed to:", fxEngineAddress);

  // Set exchange rates (1 EURC = 1.1 USDC)
  console.log("⚙️  Setting exchange rates...");
  const rate = ethers.parseEther("1.1"); // 18 decimals precision
  await mockFxEngine.setExchangeRate(ARC_CONTRACTS.EURC, ARC_CONTRACTS.USDC, rate);
  console.log("✅ Exchange rate set: 1 EURC = 1.1 USDC\n");

  // Step 2: Deploy WizPay
  console.log("📦 Deploying WizPay...");
  const feeBps = process.env.FEE_BPS || 10; // 0.1% default fee
  const feeCollector = process.env.FEE_COLLECTOR || deployer.address;

  const WizPay = await ethers.getContractFactory("WizPay");
  const wizPay = await WizPay.deploy(
    fxEngineAddress,
    feeCollector,
    feeBps
  );
  await wizPay.waitForDeployment();
  const wizPayAddress = await wizPay.getAddress();
  console.log("✅ WizPay deployed to:", wizPayAddress);
  console.log("   Fee: ", feeBps, "bps (", (feeBps / 100).toFixed(2), "%)");
  console.log("   Fee Collector:", feeCollector, "\n");

  // Step 3: Configure whitelist (optional)
  console.log("⚙️  Configuring token whitelist...");
  await wizPay.batchSetTokenWhitelist(
    [ARC_CONTRACTS.USDC, ARC_CONTRACTS.EURC, ARC_CONTRACTS.USYC],
    true
  );
  console.log("✅ Whitelisted: USDC, EURC, USYC");
  
  // Keep whitelist disabled by default for flexibility
  console.log("ℹ️  Whitelist is disabled (flexible mode)\n");

  // Step 4: Prepare to use REAL ARC tokens
  console.log("💰 Using REAL ARC Testnet tokens:");
  console.log("   USDC:", ARC_CONTRACTS.USDC);
  console.log("   EURC:", ARC_CONTRACTS.EURC);
  console.log("   USYC:", ARC_CONTRACTS.USYC);
  console.log("\n⚠️  NOTE: You need to fund MockFXEngine with real testnet tokens");
  console.log("   Get tokens from: https://faucet.circle.com");
  console.log("   Then manually transfer to FX Engine:", fxEngineAddress, "\n");

  // Summary
  console.log("═══════════════════════════════════════════════");
  console.log("🎉 WizPay Deployment Complete!");
  console.log("═══════════════════════════════════════════════");
  console.log("📍 Contract Addresses:");
  console.log("   WizPay:        ", wizPayAddress);
  console.log("   MockFXEngine:  ", fxEngineAddress);
  console.log("\n🪙  ARC Testnet Tokens (REAL, not mock):");
  console.log("   USDC:          ", ARC_CONTRACTS.USDC);
  console.log("   EURC:          ", ARC_CONTRACTS.EURC);
  console.log("   USYC:          ", ARC_CONTRACTS.USYC);
  console.log("\n🔗 Network Info:");
  console.log("   Network:       ARC Testnet");
  console.log("   Chain ID:      5042002");

  // Save deployment info
  const deploymentInfo = {
    network: "arc-testnet",
    chainId: 5042002,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      WizPay: wizPayAddress,
      MockFXEngine: fxEngineAddress,
      RealUSDC: ARC_CONTRACTS.USDC,
      RealEURC: ARC_CONTRACTS.EURC,
      RealUSYC: ARC_CONTRACTS.USYC,
    },
    config: {
      feeBps: feeBps.toString(),
      feeCollector: feeCollector,
      whitelistEnabled: false,
    },
  };

  console.log("💾 Deployment info saved to: deployments/arc-testnet-wizpay.json");
  
  // Save to file
  const fs = await import('fs');
  const path = await import('path');
  const deploymentsDir = path.join(process.cwd(), 'deployments');
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, 'arc-testnet-wizpay.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
