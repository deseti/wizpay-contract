import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

/**
 * Real Payment Test on ARC Testnet - Verifiable in Explorer
 */
async function main() {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║        Real Payment Test on ARC Testnet                        ║");
    console.log("║     View Transactions in: https://testnet.arcscan.app          ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await hre.ethers.getSigners();

    const WIZPAY_ADDRESS = process.env.WIZPAY_ADDRESS;
    const EURC = process.env.ARC_EURC;
    const USDC = process.env.ARC_USDC;

    console.log("Account: " + deployer.address);
    console.log("WizPay: " + WIZPAY_ADDRESS);
    console.log();

    // ============================================================
    // Step 1: Approve EURC
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 1: Approve EURC for WizPay");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const eurcABI = ["function approve(address spender, uint256 amount) external returns (bool)"];
        const eurc = new hre.ethers.Contract(EURC, eurcABI, deployer);

        const approveAmount = hre.ethers.parseUnits("1", 6);
        console.log("Approving 1 EURC...");
        const approveTx = await eurc.approve(WIZPAY_ADDRESS, approveAmount);

        console.log("Waiting for confirmation...");
        const approveReceipt = await approveTx.wait();

        console.log("✅ Approved on ARC Testnet");
        console.log("Block:", approveReceipt.blockNumber);
        console.log("Tx: " + approveTx.hash);
        console.log("View: https://testnet.arcscan.app/tx/" + approveTx.hash);
        console.log();

    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }

    // ============================================================
    // Step 2: Fetch current rate
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 2: Get Current Exchange Rate");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    let rate = 1.16;
    try {
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
        const data = await response.json();
        rate = data.rates.USD;
        console.log("Rate: 1 EUR = " + rate.toFixed(4) + " USD");
        console.log();
    } catch (err) {
        console.log("Using fallback rate: 1.16");
    }

    // ============================================================
    // Step 3: Execute payment
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 3: Execute Payment on ARC");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const wizpayABI = [
            "function routeAndPay(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient) external"
        ];
        const wizpay = new hre.ethers.Contract(WIZPAY_ADDRESS, wizpayABI, deployer);

        const amountIn = hre.ethers.parseUnits("1", 6);
        const expectedOut = 1.05; // Force safe minimum amount out for 1 EURC = 1.09 USDC
        const minAmountOut = hre.ethers.parseUnits(expectedOut.toFixed(2), 6);

        console.log("Payment Details:");
        console.log("  Input: 1 EURC");
        console.log("  Expected: ~" + (rate * 0.985).toFixed(4) + " USDC");
        console.log();

        console.log("Submitting transaction to ARC testnet...");
        const paymentTx = await wizpay.routeAndPay(
            EURC,
            USDC,
            amountIn,
            minAmountOut,
            deployer.address
        );

        console.log("Transaction submitted: " + paymentTx.hash);
        console.log("Waiting for confirmation...");
        const paymentReceipt = await paymentTx.wait();

        console.log("✅ Payment confirmed on ARC Testnet!");
        console.log("Block:", paymentReceipt.blockNumber);
        console.log("Tx: " + paymentTx.hash);
        console.log();

        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║  ✅ REAL TRANSACTION CONFIRMED ON ARC TESTNET                 ║");
        console.log("║                                                                ║");
        console.log("║  Approval:  https://testnet.arcscan.app/tx/<approval-hash>     ║");
        console.log("║  Payment:   https://testnet.arcscan.app/tx/" + paymentTx.hash.slice(0, 30) + "  ║");
        console.log("║                                                                ║");
        console.log("║  Copy transaction hash above into ARC Explorer to verify       ║");
        console.log("║  Explorer: https://testnet.arcscan.app                         ║");
        console.log("╚════════════════════════════════════════════════════════════════╝");
        console.log();

    } catch (err) {
        console.error("❌ Payment failed:", err.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error.message);
        process.exit(1);
    });
