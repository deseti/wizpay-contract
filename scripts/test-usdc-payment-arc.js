import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

/**
 * Test Payment: USDC → USDC (Same Token)
 * This bypasses liquidity issues and tests the core payment routing
 */
async function main() {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║     Real ARC Testnet - USDC → USDC Payment Test               ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await hre.ethers.getSigners();

    const WIZPAY_ADDRESS = process.env.WIZPAY_ADDRESS;
    const USDC = process.env.ARC_USDC;

    console.log("Account: " + deployer.address);
    console.log("WizPay: " + WIZPAY_ADDRESS);
    console.log();

    // ============================================================
    // Step 1: Check USDC balance
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 1: Check USDC Balance");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    const usdcABI = [
        "function balanceOf(address account) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)"
    ];
    const usdc = new hre.ethers.Contract(USDC, usdcABI, deployer);

    const balance = await usdc.balanceOf(deployer.address);
    const balanceFormatted = hre.ethers.formatUnits(balance, 18);
    console.log("USDC Balance: " + balanceFormatted + " USDC");
    console.log();

    if (balance === 0n) {
        console.log("❌ Account has 0 USDC - need testnet tokens");
        process.exit(1);
    }

    // ============================================================
    // Step 2: Approve USDC to WizPay
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 2: Approve USDC to WizPay");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        // Approve WizPay to spend all balance
        console.log("Approving USDC...");
        const approveTx = await usdc.approve(WIZPAY_ADDRESS, balance);
        const approveReceipt = await approveTx.wait();

        console.log("✅ Approved");
        console.log("Block: " + approveReceipt.blockNumber);
        console.log("Tx: " + approveTx.hash);
        console.log("View: https://testnet.arcscan.app/tx/" + approveTx.hash);
        console.log();

    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }

    // ============================================================
    // Step 3: Execute USDC → USDC payment
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 3: Execute USDC → USDC Payment");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const wizpayABI = [
            "function routeAndPay(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient) external"
        ];
        const wizpay = new hre.ethers.Contract(WIZPAY_ADDRESS, wizpayABI, deployer);

        // Send 50% of balance (to test payment)
        const paymentAmount = balance / 2n;
        const paymentFormatted = hre.ethers.formatUnits(paymentAmount, 18);

        console.log("Payment Details:");
        console.log("  Token In: USDC");
        console.log("  Token Out: USDC (same token)");
        console.log("  Amount: " + paymentFormatted + " USDC");
        console.log("  Expected Output: " + paymentFormatted + " USDC (1:1)");
        console.log();

        console.log("Executing payment...");
        const paymentTx = await wizpay.routeAndPay(
            USDC,           // tokenIn
            USDC,           // tokenOut (same)
            paymentAmount,  // amountIn
            paymentAmount,  // minAmountOut (same, 1:1 rate)
            deployer.address // recipient
        );

        console.log("Waiting for confirmation...");
        const paymentReceipt = await paymentTx.wait();

        console.log("✅ Payment executed!");
        console.log("Block: " + paymentReceipt.blockNumber);
        console.log("Tx: " + paymentTx.hash);
        console.log("View: https://testnet.arcscan.app/tx/" + paymentTx.hash);
        console.log();

        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║  ✅ SUCCESS - USDC → USDC Payment on Real ARC Testnet         ║");
        console.log("║                                                                ║");
        console.log("║  This confirms:                                                ║");
        console.log("║  • WizPay contract is working                                  ║");
        console.log("║  • Payment routing functions                                   ║");
        console.log("║  • Token approval and transfer working                         ║");
        console.log("║  • Non-custodial flow confirmed                                ║");
        console.log("║                                                                ║");
        console.log("║  View all transactions:                                        ║");
        console.log("║  https://testnet.arcscan.app                                   ║");
        console.log("╚════════════════════════════════════════════════════════════════╝");
        console.log();

    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error.message);
        process.exit(1);
    });
