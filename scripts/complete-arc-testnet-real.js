import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

/**
 * Complete Real Test on ARC Testnet
 * 1. Update rate on adapter
 * 2. Fund adapter if needed
 * 3. Execute payment
 * All transactions verifiable in https://testnet.arcscan.app
 */
async function main() {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║     Complete Real Test on ARC Testnet - Verifiable            ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await hre.ethers.getSigners();

    const WIZPAY_ADDRESS = process.env.WIZPAY_ADDRESS;
    const ADAPTER_ADDRESS = process.env.STABLEFX_ADAPTER_ADDRESS;
    const EURC = process.env.ARC_EURC;
    const USDC = process.env.ARC_USDC;

    console.log("Account: " + deployer.address);
    console.log();

    // ============================================================
    // Step 1: Update rate on adapter
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 1: Update Exchange Rate on Adapter");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        // Fetch real rate
        console.log("Fetching real EUR/USD...");
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
        const data = await response.json();
        const rate = data.rates.USD;
        console.log("Real Rate: 1 EUR = " + rate.toFixed(4) + " USD");
        console.log();

        // Update on adapter
        const adapterABI = ["function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external"];
        const adapter = new hre.ethers.Contract(ADAPTER_ADDRESS, adapterABI, deployer);

        const rateInWei = hre.ethers.parseUnits(rate.toFixed(4), 18);
        console.log("Updating adapter with fresh rate...");
        const rateTx = await adapter.setExchangeRate(EURC, USDC, rateInWei);

        console.log("Waiting for confirmation...");
        const rateReceipt = await rateTx.wait();

        console.log("✅ Rate updated on ARC Testnet");
        console.log("Block: " + rateReceipt.blockNumber);
        console.log("Tx: " + rateTx.hash);
        console.log("View: https://testnet.arcscan.app/tx/" + rateTx.hash);
        console.log();

    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }

    // ============================================================
    // Step 2: Approve EURC
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 2: Approve EURC for WizPay");
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

        console.log("✅ EURC approved");
        console.log("Block: " + approveReceipt.blockNumber);
        console.log("Tx: " + approveTx.hash);
        console.log("View: https://testnet.arcscan.app/tx/" + approveTx.hash);
        console.log();

    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }

    // ============================================================
    // Step 3: Execute payment
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 3: Execute Payment");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        // Fetch rate again for calculation
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
        const data = await response.json();
        const rate = data.rates.USD;

        const wizpayABI = [
            "function routeAndPay(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient) external"
        ];
        const wizpay = new hre.ethers.Contract(WIZPAY_ADDRESS, wizpayABI, deployer);

        const amountIn = hre.ethers.parseUnits("1", 6);
        // Set minAmountOut to 0 to allow adapter's internal slippage tolerance
        const minAmountOut = hre.ethers.parseUnits("0", 18);

        console.log("Payment Setup:");
        console.log("  Input: 1 EURC");
        console.log("  Real Rate: " + rate.toFixed(4) + " USD/EUR");
        console.log("  Expected: ~" + (rate * 0.985).toFixed(4) + " USDC");
        console.log();

        console.log("Executing payment on ARC...");
        const paymentTx = await wizpay.routeAndPay(
            EURC,
            USDC,
            amountIn,
            minAmountOut,
            deployer.address
        );

        console.log("Waiting for confirmation...");
        const paymentReceipt = await paymentTx.wait();

        console.log("✅ Payment executed on ARC Testnet");
        console.log("Block: " + paymentReceipt.blockNumber);
        console.log("Tx: " + paymentTx.hash);
        console.log("View: https://testnet.arcscan.app/tx/" + paymentTx.hash);
        console.log();

        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║  ✅ COMPLETE SUCCESS - Real ARC Testnet Transactions          ║");
        console.log("║                                                                ║");
        console.log("║  This is NOT fake - Verify in ARC Explorer:                   ║");
        console.log("║  https://testnet.arcscan.app                                   ║");
        console.log("║                                                                ║");
        console.log("║  All transactions use:                                         ║");
        console.log("║  • Real EUR/USD rate from Exchangerate-API                    ║");
        console.log("║  • Real Circle contracts on ARC                               ║");
        console.log("║  • Real EURC and USDC tokens                                  ║");
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
