import hre from "hardhat";

/**
 * Enterprise Batch Payment Test
 * Tests: referenceId memo, batch routing, event parsing
 */
async function main() {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║  🏢 WizPay Enterprise Batch Test - ARC Testnet               ║");
    console.log("║  Reference ID: ARC-PAYROLL-001 | EURC → USDC                 ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await hre.ethers.getSigners();
    const ADAPTER = "0xd39d4e6e15000fb6039C491BEBfaf93dC9048F9F";
    const EURC    = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
    const USDC    = "0x3600000000000000000000000000000000000000";
    const USYC    = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C";

    const IERC20_ABI = [
        "function balanceOf(address) view returns (uint256)",
        "function approve(address,uint256) returns (bool)"
    ];
    const eurc = new hre.ethers.Contract(EURC, IERC20_ABI, deployer);

    // ── Step 1: Deploy WizPay v3 Enterprise ───────────────────────
    console.log("📦 Step 1: Deploying WizPay v3 (Enterprise Grade)...");
    const WizPay = await hre.ethers.getContractFactory("WizPay");
    const wizpay = await WizPay.deploy(ADAPTER, deployer.address, 10);
    await wizpay.waitForDeployment();
    const wizpayAddr = await wizpay.getAddress();
    console.log("   ✅ WizPay v3 deployed to:", wizpayAddr);

    // Whitelist tokens
    await wizpay.batchSetTokenWhitelist([USDC, EURC, USYC], true).then(t => t.wait());
    await wizpay.setWhitelistEnabled(true).then(t => t.wait());
    console.log("   ✅ Tokens whitelisted\n");

    // ── Step 2: Refresh exchange rates ────────────────────────────
    console.log("⚙️  Step 2: Refreshing exchange rates...");
    const adapter = await hre.ethers.getContractAt("StableFXAdapter", ADAPTER);
    await adapter.setExchangeRate(EURC, USDC, hre.ethers.parseUnits("1.09", 18)).then(t => t.wait());
    await adapter.setExchangeRate(USDC, EURC, hre.ethers.parseUnits("0.917", 18)).then(t => t.wait());
    console.log("   ✅ 1 EURC = 1.09 USDC");

    // Top up adapter liquidity
    const usdc = new hre.ethers.Contract(USDC, IERC20_ABI, deployer);
    const liqAmount = hre.ethers.parseUnits("3", 6);
    await usdc.approve(ADAPTER, liqAmount).then(t => t.wait());
    await adapter.addLiquidity(USDC, liqAmount).then(t => t.wait());
    console.log("   ✅ Adapter funded with 3 USDC liquidity\n");

    // ── Step 3: Pre-flight checks ─────────────────────────────────
    console.log("📊 Step 3: Pre-flight Checks");
    const eurcBal = await eurc.balanceOf(deployer.address);
    console.log("   EURC Balance:", hre.ethers.formatUnits(eurcBal, 6));

    const recipients = [
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
        "0x0000000000000000000000000000000000000003"
    ];
    const amountsIn = [
        hre.ethers.parseUnits("0.5", 6),
        hre.ethers.parseUnits("0.3", 6),
        hre.ethers.parseUnits("0.2", 6),
    ];
    const minAmountsOut = [
        hre.ethers.parseUnits("0.50", 6),
        hre.ethers.parseUnits("0.30", 6),
        hre.ethers.parseUnits("0.20", 6),
    ];
    const REFERENCE_ID = "ARC-PAYROLL-001";
    const totalInput = amountsIn.reduce((a, b) => a + b, 0n);

    console.log("   Total Input: ", hre.ethers.formatUnits(totalInput, 6), "EURC");
    console.log("   Reference ID:", REFERENCE_ID, "\n");

    // ── Step 4: Approve ───────────────────────────────────────────
    console.log("🔐 Step 4: Approving EURC...");
    await eurc.approve(wizpayAddr, totalInput).then(t => t.wait());
    console.log("   ✅ Approved\n");

    // ── Step 5: Execute Enterprise Batch ──────────────────────────
    console.log("🚀 Step 5: Executing batchRouteAndPay with memo...");
    const startTime = Date.now();

    const batchTx = await wizpay.batchRouteAndPay(
        EURC, USDC, recipients, amountsIn, minAmountsOut, REFERENCE_ID
    );
    console.log("   Tx submitted:", batchTx.hash);
    const receipt = await batchTx.wait();
    const elapsed = Date.now() - startTime;

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║  ✅ ENTERPRISE BATCH PAYROLL SUCCESSFUL!                      ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    console.log("   📊 Transaction Details:");
    console.log("      Tx Hash:      ", batchTx.hash);
    console.log("      Block:        ", receipt.blockNumber);
    console.log("      Gas Used:     ", receipt.gasUsed.toString());
    console.log("      Time:         ", elapsed + "ms");
    console.log();

    // ── Step 6: Parse Events ──────────────────────────────────────
    console.log("   📤 Individual PaymentRouted Events:");
    let count = 0;
    for (const log of receipt.logs) {
        try {
            const parsed = wizpay.interface.parseLog(log);
            if (parsed && parsed.name === "PaymentRouted") {
                count++;
                console.log(`      #${count}: ${parsed.args[1].slice(0,10)}... | ${hre.ethers.formatUnits(parsed.args[4], 6)} EURC → ${hre.ethers.formatUnits(parsed.args[5], 6)} USDC`);
            }
            if (parsed && parsed.name === "BatchPaymentRouted") {
                console.log();
                console.log("   📦 BatchPaymentRouted Event:");
                console.log("      Sender:       ", parsed.args[0]);
                console.log("      Token In:     ", parsed.args[1]);
                console.log("      Token Out:    ", parsed.args[2]);
                console.log("      Total In:     ", hre.ethers.formatUnits(parsed.args[3], 6), "EURC");
                console.log("      Total Out:    ", hre.ethers.formatUnits(parsed.args[4], 6), "USDC");
                console.log("      Total Fees:   ", hre.ethers.formatUnits(parsed.args[5], 6), "EURC");
                console.log("      Recipients:   ", parsed.args[6].toString());
                console.log("      ┌──────────────────────────────────────────────┐");
                console.log("      │ 📝 Reference ID: " + parsed.args[7] + "                  │");
                console.log("      └──────────────────────────────────────────────┘");
            }
        } catch (e) { /* skip */ }
    }

    console.log();
    console.log("   🔗 Verify on ArcScan:");
    console.log("      https://testnet.arcscan.app/tx/" + batchTx.hash);
    console.log();
    console.log("   📋 Update .env with new WizPay v3 address:");
    console.log("      WIZPAY_ADDRESS=" + wizpayAddr);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Failed:", error.message);
        process.exit(1);
    });
