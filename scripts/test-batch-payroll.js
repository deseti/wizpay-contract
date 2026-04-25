import hre from "hardhat";

/**
 * Test Batch Payroll - Sends EURC to 3 recipients atomically via batchRouteAndPay
 * Each recipient receives USDC after FX conversion through StableFXAdapter
 */
async function main() {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║     🧾 WizPay Batch Payroll Test - ARC Testnet               ║");
    console.log("║     3 Recipients | EURC → USDC | Real StableFX Rates         ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await hre.ethers.getSigners();
    const ADAPTER = "0xd39d4e6e15000fb6039C491BEBfaf93dC9048F9F";
    const WIZPAY  = "0xB94700A4eC6AAb8e49d24eA73aA80Dbb98a09Dd7";
    const EURC    = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
    const USDC    = "0x3600000000000000000000000000000000000000";

    const IERC20_ABI = [
        "function balanceOf(address) view returns (uint256)",
        "function approve(address,uint256) returns (bool)",
        "function decimals() view returns (uint8)"
    ];

    const eurc = new hre.ethers.Contract(EURC, IERC20_ABI, deployer);
    const usdc = new hre.ethers.Contract(USDC, IERC20_ABI, deployer);

    // ── Step 0: Refresh exchange rates (5-min expiry) ──────────────
    console.log("⚙️  Step 0: Refreshing exchange rates on Adapter...");
    const adapter = await hre.ethers.getContractAt("StableFXAdapter", ADAPTER);
    await adapter.setExchangeRate(EURC, USDC, hre.ethers.parseUnits("1.09", 18)).then(t => t.wait());
    await adapter.setExchangeRate(USDC, EURC, hre.ethers.parseUnits("0.917", 18)).then(t => t.wait());
    console.log("   ✅ Rates refreshed: 1 EURC = 1.09 USDC\n");

    // ── Step 1: Pre-flight checks ─────────────────────────────────
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 1: Pre-flight Checks");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const eurcBal = await eurc.balanceOf(deployer.address);
    const usdcBal = await usdc.balanceOf(deployer.address);
    console.log(`   Sender:      ${deployer.address}`);
    console.log(`   EURC Balance: ${hre.ethers.formatUnits(eurcBal, 6)} EURC`);
    console.log(`   USDC Balance: ${hre.ethers.formatUnits(usdcBal, 6)} USDC\n`);

    // 3 simulated employee/recipient addresses (using deterministic test addresses)
    // In testnet, we send to the deployer itself (since these are test wallets)
    const recipients = [
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
        "0x0000000000000000000000000000000000000003"
    ];

    // Payroll: Employee 1 gets 0.5 EURC, Employee 2 gets 0.3 EURC, Employee 3 gets 0.2 EURC
    const amountsIn = [
        hre.ethers.parseUnits("0.5", 6),
        hre.ethers.parseUnits("0.3", 6),
        hre.ethers.parseUnits("0.2", 6),
    ];

    // Safe minimums: well under 1.09 rate to pass slippage
    const minAmountsOut = [
        hre.ethers.parseUnits("0.50", 6),
        hre.ethers.parseUnits("0.30", 6),
        hre.ethers.parseUnits("0.20", 6),
    ];

    const totalInput = amountsIn.reduce((a, b) => a + b, 0n);
    console.log("   📋 Payroll Batch:");
    console.log(`      Employee 1 (${recipients[0].slice(0,10)}...): 0.50 EURC`);
    console.log(`      Employee 2 (${recipients[1].slice(0,10)}...): 0.30 EURC`);
    console.log(`      Employee 3 (${recipients[2].slice(0,10)}...): 0.20 EURC`);
    console.log(`      ─────────────────────────────────────`);
    console.log(`      Total:                               ${hre.ethers.formatUnits(totalInput, 6)} EURC\n`);

    if (eurcBal < totalInput) {
        console.error("❌ Insufficient EURC balance! Need", hre.ethers.formatUnits(totalInput, 6), "EURC");
        process.exit(1);
    }

    // ── Step 2: Approve WizPay to spend total EURC ────────────────
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 2: Approve WizPay Contract");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const approveTx = await eurc.approve(WIZPAY, totalInput);
    await approveTx.wait();
    console.log(`   ✅ Approved ${hre.ethers.formatUnits(totalInput, 6)} EURC`);
    console.log(`   Tx: ${approveTx.hash}\n`);

    // ── Step 3: Check adapter liquidity ───────────────────────────
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 3: Verify Adapter Liquidity");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const adapterUSDC = await adapter.getLiquidity(USDC);
    console.log(`   Adapter USDC Liquidity: ${hre.ethers.formatUnits(adapterUSDC, 6)} USDC`);
    const expectedTotalOut = hre.ethers.parseUnits("1.09", 6); // ~1.09 USDC total for 1 EURC
    if (adapterUSDC < expectedTotalOut) {
        console.log("   ⚠️  Liquidity might be tight, attempting anyway...\n");
    } else {
        console.log("   ✅ Sufficient liquidity\n");
    }

    // ── Step 4: Execute batchRouteAndPay! ─────────────────────────
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 4: 🚀 Execute Batch Payroll");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const startTime = Date.now();

    try {
        const wizpay = await hre.ethers.getContractAt("WizPay", WIZPAY);

        const batchTx = await wizpay.batchRouteAndPay(
            EURC,
            USDC,
            recipients,
            amountsIn,
            minAmountsOut
        );

        console.log("   ⏳ Transaction submitted:", batchTx.hash);
        console.log("   Waiting for confirmation...\n");

        const receipt = await batchTx.wait();
        const elapsed = Date.now() - startTime;

        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║  ✅ BATCH PAYROLL SUCCESSFUL!                                ║");
        console.log("╚════════════════════════════════════════════════════════════════╝\n");

        console.log("   📊 Transaction Details:");
        console.log(`      Tx Hash:    ${batchTx.hash}`);
        console.log(`      Block:      ${receipt.blockNumber}`);
        console.log(`      Gas Used:   ${receipt.gasUsed.toString()}`);
        console.log(`      Time:       ${elapsed}ms`);
        console.log(`      Recipients: ${recipients.length}`);
        console.log();

        // Parse events
        const wizpayContract = await hre.ethers.getContractAt("WizPay", WIZPAY);
        const batchFilter = wizpayContract.filters.BatchPaymentRouted;
        const paymentFilter = wizpayContract.filters.PaymentRouted;

        console.log("   📤 Individual Payment Events:");
        let eventCount = 0;
        for (const log of receipt.logs) {
            try {
                const parsed = wizpayContract.interface.parseLog(log);
                if (parsed && parsed.name === "PaymentRouted") {
                    eventCount++;
                    const recip = parsed.args[1];
                    const amtIn = parsed.args[4];
                    const amtOut = parsed.args[5];
                    const fee = parsed.args[6];
                    console.log(`      #${eventCount}: ${recip.slice(0,10)}... | ${hre.ethers.formatUnits(amtIn, 6)} EURC → ${hre.ethers.formatUnits(amtOut, 6)} USDC (fee: ${hre.ethers.formatUnits(fee, 6)})`);
                }
                if (parsed && parsed.name === "BatchPaymentRouted") {
                    console.log();
                    console.log("   📦 Batch Summary Event:");
                    console.log(`      Total In:     ${hre.ethers.formatUnits(parsed.args[4], 6)} EURC`);
                    console.log(`      Total Out:    ${hre.ethers.formatUnits(parsed.args[5], 6)} USDC`);
                    console.log(`      Total Fees:   ${hre.ethers.formatUnits(parsed.args[6], 6)} EURC`);
                    console.log(`      Recipients:   ${parsed.args[7]}`);
                }
            } catch (e) {
                // Not our event, skip
            }
        }

        console.log();
        console.log("   🔗 Verify on ArcScan:");
        console.log(`      https://testnet.arcscan.app/tx/${batchTx.hash}`);
        console.log();

    } catch (err) {
        console.error("❌ Batch Payroll FAILED:", err.message);
        if (err.data) console.error("   Revert:", err.data);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error.message);
        process.exit(1);
    });
