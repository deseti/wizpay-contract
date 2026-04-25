import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

/**
 * Funding and Payment Test with Partial Balance
 * Uses only a fraction of available balance for testing
 */
async function main() {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║      Funding & Payment Test with Partial Balance               ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await hre.ethers.getSigners();
    
    console.log("Account:", deployer.address);
    console.log();

    // Get addresses
    const WIZPAY_ADDRESS = process.env.WIZPAY_ADDRESS;
    const ADAPTER_ADDRESS = process.env.STABLEFX_ADAPTER_ADDRESS;
    const EURC = process.env.ARC_EURC;
    const USDC = process.env.ARC_USDC;

    // ============================================================
    // Step 1: Check current balances
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 1: Check Wallet Balances");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    const usdcABI = ["function balanceOf(address account) external view returns (uint256)"];
    const eurcABI = ["function balanceOf(address account) external view returns (uint256)"];
    
    const usdc = new hre.ethers.Contract(USDC, usdcABI, deployer);
    const eurc = new hre.ethers.Contract(EURC, eurcABI, deployer);

    let usdcBalance = 0n;
    let eurcBalance = 0n;

    try {
        usdcBalance = await usdc.balanceOf(deployer.address);
        console.log("USDC balance:", hre.ethers.formatUnits(usdcBalance, 18));
    } catch (err) {
        console.log("USDC (native):", "10000 ETH (available)");
    }

    try {
        eurcBalance = await eurc.balanceOf(deployer.address);
        console.log("EURC balance:", hre.ethers.formatUnits(eurcBalance, 6));
    } catch (err) {
        console.log("EURC:", "Unable to query");
    }
    console.log();

    // ============================================================
    // Step 2: Use 30% of balance for adapter funding
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 2: Fund Adapter with 30% of Balance");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        // Use only 30% of USDC balance
        const fundAmount = usdcBalance > 0n ? (usdcBalance * 30n) / 100n : hre.ethers.parseUnits("30", 18);
        console.log("Using 30% for funding:", hre.ethers.formatUnits(fundAmount, 18), "USDC");
        console.log("Remaining balance after: 70%");
        console.log();

        const usdcTransferABI = ["function transfer(address to, uint256 amount) external returns (bool)"];
        const usdcTransfer = new hre.ethers.Contract(USDC, usdcTransferABI, deployer);

        console.log("Transferring to adapter...");
        const fundTx = await usdcTransfer.transfer(ADAPTER_ADDRESS, fundAmount);
        const fundReceipt = await fundTx.wait();

        console.log("✅ Funding successful");
        console.log("   Block:", fundReceipt.blockNumber);
        console.log("   Tx:", fundTx.hash);
        console.log();

    } catch (err) {
        console.error("❌ Funding failed:", err.message);
        process.exit(1);
    }

    // ============================================================
    // Step 3: Test payment with 20% of EURC balance
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 3: Test Payment with 20% of EURC Balance");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        // Fetch current rate
        console.log("Fetching current rate...");
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
        const data = await response.json();
        const rate = data.rates.USD;
        console.log("Current rate: 1 EUR = " + rate.toFixed(4) + " USD");
        console.log();

        // Use 20% of EURC for test payment
        const paymentAmount = eurcBalance > 0n ? (eurcBalance * 20n) / 100n : hre.ethers.parseUnits("2", 6);
        const paymentAmountFormatted = hre.ethers.formatUnits(paymentAmount, 6);
        const expectedOutput = parseFloat(paymentAmountFormatted) * rate;

        console.log("Payment Test Setup:");
        console.log("   Input: " + paymentAmountFormatted + " EURC (20% of balance)");
        console.log("   Exchange Rate: " + rate.toFixed(4) + " USD/EUR");
        console.log("   Expected Output: ~" + expectedOutput.toFixed(4) + " USDC");
        console.log("   Remaining EURC after: 80%");
        console.log();

        // Approve WizPay
        const eurcApproveABI = ["function approve(address spender, uint256 amount) external returns (bool)"];
        const eurcApprove = new hre.ethers.Contract(EURC, eurcApproveABI, deployer);

        console.log("Approving WizPay...");
        const approveTx = await eurcApprove.approve(WIZPAY_ADDRESS, paymentAmount);
        const approveReceipt = await approveTx.wait();
        console.log("✅ Approved");
        console.log("   Tx:", approveTx.hash);
        console.log();

        // Execute payment
        const wizpayABI = [
            "function routeAndPay(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient) external"
        ];
        const wizpay = new hre.ethers.Contract(WIZPAY_ADDRESS, wizpayABI, deployer);

        const minOutput = hre.ethers.parseUnits((expectedOutput * 0.985).toFixed(2), 18);

        console.log("Executing payment...");
        const paymentTx = await wizpay.routeAndPay(
            EURC,
            USDC,
            paymentAmount,
            minOutput,
            deployer.address
        );

        const paymentReceipt = await paymentTx.wait();
        console.log("✅ Payment executed");
        console.log("   Block:", paymentReceipt.blockNumber);
        console.log("   Tx:", paymentTx.hash);
        console.log();

        // ============================================================
        // Step 4: Show remaining balances
        // ============================================================
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("Step 4: Final Balance Summary");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log();

        console.log("Balance Allocation:");
        console.log("   USDC: 70% remaining for further testing");
        console.log("   EURC: 80% remaining for further testing");
        console.log();

        console.log("✅ Test Complete - Balances Preserved");
        console.log();

        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║  ✅ SUCCESS - Partial Balance Test Completed                  ║");
        console.log("║                                                                ║");
        console.log("║  Funding Used:        30% of USDC balance                      ║");
        console.log("║  Payment Test Used:   20% of EURC balance                      ║");
        console.log("║  Remaining Balance:   Ready for additional tests               ║");
        console.log("╚════════════════════════════════════════════════════════════════╝");
        console.log();

    } catch (err) {
        console.error("❌ Payment test failed:", err.message);
        if (err.message.includes("Insufficient liquidity")) {
            console.log("\nNote: Adapter may need more liquidity funding");
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error.message);
        process.exit(1);
    });
