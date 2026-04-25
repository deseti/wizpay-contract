import hre from "hardhat";

/**
 * Redeploy WizPay with batchRouteAndPay, reconnect to existing StableFXAdapter,
 * re-fund adapter liquidity, and re-whitelist tokens.
 */
async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const ADAPTER = "0xd39d4e6e15000fb6039C491BEBfaf93dC9048F9F";
    const EURC    = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
    const USDC    = "0x3600000000000000000000000000000000000000";
    const USYC    = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C";

    console.log("🚀 Re-deploying WizPay (v2 - with Batch Payout)...");
    console.log("   Account:", deployer.address);

    // Deploy new WizPay pointing to existing StableFXAdapter
    const WizPay = await hre.ethers.getContractFactory("WizPay");
    const wizpay = await WizPay.deploy(ADAPTER, deployer.address, 10); // 10 bps fee
    await wizpay.waitForDeployment();
    const newAddress = await wizpay.getAddress();

    console.log("✅ WizPay v2 deployed to:", newAddress);

    // Whitelist tokens
    console.log("⚙️  Whitelisting tokens...");
    await wizpay.batchSetTokenWhitelist([USDC, EURC, USYC], true).then(t => t.wait());
    await wizpay.setWhitelistEnabled(true).then(t => t.wait());
    console.log("   ✅ USDC, EURC, USYC whitelisted");

    // Verify connection
    const engineAddr = await wizpay.fxEngine();
    console.log("   FXEngine:", engineAddr);
    console.log("   Fee:", (await wizpay.feeBps()).toString(), "bps");

    console.log("\n📋 IMPORTANT: Update your .env with:");
    console.log(`   WIZPAY_ADDRESS=${newAddress}`);
    console.log("\n🎉 WizPay v2 is live with batchRouteAndPay!");
}

main().catch(console.error);
