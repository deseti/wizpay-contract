import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

/**
 * Send 1 EURC → USDC to Specific Address
 * Real ARC Testnet Payment
 */
async function main() {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║  Send 1 EURC → USDC to 0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484 ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await hre.ethers.getSigners();

    const WIZPAY_ADDRESS = process.env.WIZPAY_ADDRESS;
    const ADAPTER_ADDRESS = process.env.STABLEFX_ADAPTER_ADDRESS;
    const EURC = process.env.ARC_EURC;
    const USDC = process.env.ARC_USDC;
    const RECIPIENT = "0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484";

    console.log("Sender: " + deployer.address);
    console.log("Recipient: " + RECIPIENT);
    console.log();

    // ============================================================
    // Step 1: Update rate
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 1: Update Exchange Rate");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
        const data = await response.json();
        const rate = data.rates.USD;
        console.log("Real Rate: 1 EUR = " + rate.toFixed(4) + " USD");

        const adapterABI = ["function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external"];
        const adapter = new hre.ethers.Contract(ADAPTER_ADDRESS, adapterABI, deployer);

        const rateInWei = hre.ethers.parseUnits(rate.toFixed(4), 18);
        const rateTx = await adapter.setExchangeRate(EURC, USDC, rateInWei);
        await rateTx.wait();
        
        console.log("✅ Rate updated");
        console.log("Tx: " + rateTx.hash);
        console.log();

    } catch (err) {
        console.error("Error updating rate:", err.message);
    }

    // ============================================================
    // Step 2: Approve EURC
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 2: Approve 0.1 EURC to WizPay");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const eurcABI = ["function approve(address spender, uint256 amount) external returns (bool)"];
        const eurc = new hre.ethers.Contract(EURC, eurcABI, deployer);

        const approveAmount = hre.ethers.parseUnits("0.1", 6);
console.log("Approving 0.1 EURC...");

        const approveTx = await eurc.approve(WIZPAY_ADDRESS, approveAmount);
        const approveReceipt = await approveTx.wait();

        console.log("✅ Approved");
        console.log("Tx: " + approveTx.hash);
        console.log("View: https://testnet.arcscan.app/tx/" + approveTx.hash);
        console.log();

    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }

    // ============================================================
    // Step 3: Execute payment to recipient
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 3: Execute Payment to Recipient");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
        const data = await response.json();
        const rate = data.rates.USD;

        const wizpayABI = [
            "function routeAndPay(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient) external"
        ];
        const wizpay = new hre.ethers.Contract(WIZPAY_ADDRESS, wizpayABI, deployer);

        const amountIn = hre.ethers.parseUnits("0.1", 6);
        const minOut = 0n;

        console.log("Payment Details:");
        console.log("  From: " + deployer.address);
        console.log("  To: " + RECIPIENT);
        console.log("  Input: 0.1 EURC");
        console.log("  Rate: 1 EUR = " + rate.toFixed(4) + " USD");
        console.log("  Expected Output: ~" + (rate * 0.1).toFixed(4) + " USDC");
        console.log();

        console.log("Executing payment...");
        const paymentTx = await wizpay.routeAndPay(
            EURC,           // tokenIn
            USDC,           // tokenOut
            amountIn,       // 1 EURC
            minOut,         // minAmountOut
            RECIPIENT       // recipient address
        );

        const paymentReceipt = await paymentTx.wait();

        console.log("✅ Payment executed!");
        console.log("Block: " + paymentReceipt.blockNumber);
        console.log("Tx: " + paymentTx.hash);
        console.log("View: https://testnet.arcscan.app/tx/" + paymentTx.hash);
        console.log();

        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║  ✅ SUCCESS - 0.1 EURC sent as USDC to recipient              ║");
        console.log("║                                                                ║");
        console.log("║  Recipient: " + RECIPIENT + "  ║");
        console.log("║  Amount: 0.1 EURC → ~" + (rate * 0.1).toFixed(4) + " USDC                            ║");
        console.log("║  Transaction: https://testnet.arcscan.app/tx/                 ║");
        console.log("║  " + paymentTx.hash + "  ║");
        console.log("║                                                                ║");
        console.log("║  All transactions verified on real ARC Testnet                 ║");
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
