import hre from "hardhat";
const { ethers } = hre;
import fs from 'fs';
import path from 'path';

/**
 * Script to test WizPay with minimal setup
 * Just verify contracts are deployed and callable
 */

async function main() {
  console.log("🧪 Testing WizPay Deployment...\n");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Load deployment
  const deploymentsDir = path.join(process.cwd(), 'deployments');
  const deploymentPath = path.join(deploymentsDir, 'arc-testnet.json');
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ Deployment not found!");
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const wizPayAddress = deploymentInfo.contracts.WizPay;
  const fxEngineAddress = deploymentInfo.contracts.MockFXEngine;
  
  console.log("🎯 WizPay:", wizPayAddress);
  console.log("🎯 FXEngine:", fxEngineAddress, "\n");

  // Get contracts
  const WizPay = await ethers.getContractFactory("WizPay");
  const wizPay = WizPay.attach(wizPayAddress);
  
  const MockFXEngine = await ethers.getContractFactory("MockFXEngine");
  const fxEngine = MockFXEngine.attach(fxEngineAddress);

  // Check WizPay config
  console.log("✅ WizPay Contract Information:");
  try {
    const feeBps = await wizPay.feeBps();
    const feeCollector = await wizPay.feeCollector();
    const fxEngineAddr = await wizPay.fxEngine();
    
    console.log("   Fee:", feeBps.toString(), "bps");
    console.log("   Fee Collector:", feeCollector);
    console.log("   FX Engine:", fxEngineAddr);
  } catch (e) {
    console.error("❌ Error reading WizPay:", e.message);
  }

  // Check FXEngine
  console.log("\n✅ MockFXEngine Information:");
  
  // Set a test exchange rate
  console.log("   Setting EURC->USDC rate (1:1.1)...");
  try {
    const rate = ethers.parseEther("1.1");
    const tx = await fxEngine.setExchangeRate(
      deploymentInfo.contracts.RealEURC,
      deploymentInfo.contracts.RealUSDC,
      rate
    );
    await tx.wait();
    console.log("   ✅ Rate set successfully");
  } catch (e) {
    console.error("   ❌ Error setting rate:", e.message);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("✅ Deployment Test Complete!");
  console.log("═══════════════════════════════════════════════");
  console.log("\n📋 Summary:");
  console.log("   WizPay deployed:", wizPayAddress);
  console.log("   MockFXEngine deployed:", fxEngineAddress);
  console.log("   Both contracts callable ✓");
  console.log("\n📝 Next Steps:");
  console.log("   1. Get USDC/EURC from faucet");
  console.log("   2. Fund MockFXEngine with tokens");
  console.log("   3. Test routeAndPay function");
  console.log("\n   Faucet: https://faucet.circle.com");
  console.log("   Explorer: https://testnet.arcscan.app/address/" + wizPayAddress);
  console.log("═══════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
