import hre from "hardhat";

/**
 * Verify WizPay contract on ArcScan
 * 
 * Run: npx hardhat run scripts/verify-contract.js --config hardhat.config.arc.js
 */

async function main() {
  console.log("🔍 Verifying WizPay contract on ArcScan...\n");

  const WIZPAY_ADDRESS = "0x570b3d069b3350C54Ec5E78E8b2c2677ddb38C0C";
  const MOCKFXENGINE_ADDRESS = "0xF1B0a3F0BE7dAB9f7107c028faC881291734D6de";
  const FEE_COLLECTOR = "0x75b0b8EFb946e2892Bc650311D28DEFfbe015Ea9";
  const FEE_BPS = 10;

  console.log("📋 Contract Information:");
  console.log("   WizPay Address:", WIZPAY_ADDRESS);
  console.log("   FXEngine Address:", MOCKFXENGINE_ADDRESS);
  console.log("   Fee Collector:", FEE_COLLECTOR);
  console.log("   Fee BPS:", FEE_BPS, "\n");

  console.log("🔗 Constructor Arguments:");
  console.log("   _fxEngine:", MOCKFXENGINE_ADDRESS);
  console.log("   _feeCollector:", FEE_COLLECTOR);
  console.log("   _feeBps:", FEE_BPS, "\n");

  try {
    console.log("⏳ Verifying WizPay...\n");
    
    await hre.run("verify:verify", {
      address: WIZPAY_ADDRESS,
      constructorArguments: [
        MOCKFXENGINE_ADDRESS,
        FEE_COLLECTOR,
        FEE_BPS
      ],
    });

    console.log("\n✅ WizPay verified successfully!");
    console.log("🔗 View on ArcScan: https://testnet.arcscan.app/address/" + WIZPAY_ADDRESS);

  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract already verified!");
      console.log("🔗 View on ArcScan: https://testnet.arcscan.app/address/" + WIZPAY_ADDRESS);
    } else {
      console.error("❌ Verification failed:", error.message);
    }
  }

  // Also verify MockFXEngine
  console.log("\n" + "=".repeat(60));
  console.log("🔍 Verifying MockFXEngine contract on ArcScan...\n");

  try {
    console.log("⏳ Verifying MockFXEngine...\n");
    
    await hre.run("verify:verify", {
      address: MOCKFXENGINE_ADDRESS,
      constructorArguments: [],
    });

    console.log("\n✅ MockFXEngine verified successfully!");
    console.log("🔗 View on ArcScan: https://testnet.arcscan.app/address/" + MOCKFXENGINE_ADDRESS);

  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ MockFXEngine already verified!");
      console.log("🔗 View on ArcScan: https://testnet.arcscan.app/address/" + MOCKFXENGINE_ADDRESS);
    } else {
      console.error("❌ Verification failed:", error.message);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✨ Verification complete!");
  console.log("=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
