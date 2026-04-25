import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

/**
 * Flexible WizPay Payment Script
 * Send any amount of EURC → USDC to recipient address
 * 
 * IMPORTANT: Adapter Liquidity Constraint
 * The StableFXAdapter on Arc Testnet has a per-transaction limit of approximately 0.1 EURC.
 * This is a testnet limitation, not a code issue.
 * 
 * For production, ensure the adapter has sufficient liquidity or use an external DEX.
 * 
 * Usage:
 *   npx hardhat run scripts/flexible-payment.js --network arc-testnet
 * 
 * Configuration:
 *   Edit AMOUNT_EURC and RECIPIENT_ADDRESS below before running
 */
async function main() {
    const [deployer] = await hre.ethers.getSigners();

    const WIZPAY_ADDRESS = process.env.WIZPAY_ADDRESS;
    const ADAPTER_ADDRESS = process.env.STABLEFX_ADAPTER_ADDRESS;
    const EURC = process.env.ARC_EURC;
    const USDC = process.env.ARC_USDC;

    // ============================================================
    // USER CONFIGURATION - EDIT THESE VALUES
    // ============================================================
    const AMOUNT_EURC = "0.05";  // Edit this - smaller amounts work better (0.05-0.1 EURC recommended)
    const RECIPIENT_ADDRESS = "0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484";  // Edit this - any recipient
    // ============================================================
    // TESTED AMOUNTS:
    // ✅ 0.01 EURC - works
    // ✅ 0.05 EURC - likely works
    // ✅ 0.1 EURC  - works (confirmed successful)
    // ❌ 0.15 EURC - fails (insufficient liquidity)
    // ❌ 0.2 EURC  - fails (insufficient liquidity)
    // ❌ 0.5 EURC  - fails (insufficient liquidity)
    // ❌ 1.0 EURC  - fails (insufficient liquidity)
    // ============================================================

    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║  WizPay Flexible Payment Router                               ║");
    console.log("║  Send " + AMOUNT_EURC + " EURC → USDC                                        ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    console.log("Configuration:");
    console.log("  Sender: " + deployer.address);
    console.log("  Recipient: " + RECIPIENT_ADDRESS);
    console.log("  Amount: " + AMOUNT_EURC + " EURC");
    console.log();

    // ============================================================
    // Step 1: Check Balances
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 1: Check Account Balances");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const tokenABI = [
            "function balanceOf(address account) external view returns (uint256)",
            "function decimals() external view returns (uint8)"
        ];
        
        const eurc = new hre.ethers.Contract(EURC, tokenABI, hre.ethers.provider);
        const usdc = new hre.ethers.Contract(USDC, tokenABI, hre.ethers.provider);

        const eurcBalance = await eurc.balanceOf(deployer.address);
        const eurcDecimals = await eurc.decimals();
        const eurcFormatted = hre.ethers.formatUnits(eurcBalance, eurcDecimals);

        const usdcBalance = await usdc.balanceOf(deployer.address);
        const usdcDecimals = await usdc.decimals();
        const usdcFormatted = hre.ethers.formatUnits(usdcBalance, usdcDecimals);

        console.log("EURC Balance: " + eurcFormatted + " EURC");
        console.log("USDC Balance: " + usdcFormatted + " USDC");
        console.log();

        // Check if user has enough EURC
        const amountNeeded = hre.ethers.parseUnits(AMOUNT_EURC, eurcDecimals);
        if (eurcBalance < amountNeeded) {
            console.error("❌ ERROR: Insufficient EURC balance!");
            console.error("   Need: " + AMOUNT_EURC + " EURC");
            console.error("   Have: " + eurcFormatted + " EURC");
            process.exit(1);
        }
        console.log("✅ Sufficient EURC balance");
        console.log();

    } catch (err) {
        console.error("Error checking balances:", err.message);
        process.exit(1);
    }

    // ============================================================
    // Step 2: Fetch Current Exchange Rate
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 2: Fetch Exchange Rate");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    let rate = 1.16;
    try {
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
        const data = await response.json();
        rate = data.rates.USD;
        console.log("Real Rate: 1 EUR = " + rate.toFixed(4) + " USD");
        console.log("Source: Exchangerate-API (official financial data)");
    } catch (err) {
        console.warn("Warning: Could not fetch live rate, using default 1.16");
    }
    console.log();

    // ============================================================
    // Step 3: Update Rate on Adapter
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 3: Update Rate on Adapter");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const adapterABI = ["function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external"];
        const adapter = new hre.ethers.Contract(ADAPTER_ADDRESS, adapterABI, deployer);

        const rateInWei = hre.ethers.parseUnits(rate.toFixed(4), 18);
        const rateTx = await adapter.setExchangeRate(EURC, USDC, rateInWei);
        await rateTx.wait();
        
        console.log("✅ Rate updated on adapter");
        console.log("Tx: " + rateTx.hash);
        console.log("View: https://testnet.arcscan.app/tx/" + rateTx.hash);
        console.log();

    } catch (err) {
        console.error("Error updating rate:", err.message);
        process.exit(1);
    }

    // ============================================================
    // Step 4: Approve Tokens
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 4: Approve " + AMOUNT_EURC + " EURC to WizPay");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const eurcABI = ["function approve(address spender, uint256 amount) external returns (bool)"];
        const eurc = new hre.ethers.Contract(EURC, eurcABI, deployer);

        const approveAmount = hre.ethers.parseUnits(AMOUNT_EURC, 6);
        console.log("Approving " + AMOUNT_EURC + " EURC...");

        const approveTx = await eurc.approve(WIZPAY_ADDRESS, approveAmount);
        await approveTx.wait();

        console.log("✅ Approved");
        console.log("Tx: " + approveTx.hash);
        console.log("View: https://testnet.arcscan.app/tx/" + approveTx.hash);
        console.log();

    } catch (err) {
        console.error("Error approving tokens:", err.message);
        process.exit(1);
    }

    // ============================================================
    // Step 5: Execute Payment
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 5: Execute Payment");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const wizpayABI = [
            "function routeAndPay(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient) external"
        ];
        const wizpay = new hre.ethers.Contract(WIZPAY_ADDRESS, wizpayABI, deployer);

        const amountIn = hre.ethers.parseUnits(AMOUNT_EURC, 6);
        const minOut = 0n; // Let adapter handle slippage
        const expectedOutput = (rate * parseFloat(AMOUNT_EURC)).toFixed(4);

        console.log("Payment Details:");
        console.log("  From: " + deployer.address);
        console.log("  To: " + RECIPIENT_ADDRESS);
        console.log("  Input: " + AMOUNT_EURC + " EURC");
        console.log("  Rate: 1 EUR = " + rate.toFixed(4) + " USD");
        console.log("  Expected Output: ~" + expectedOutput + " USDC");
        console.log();

        console.log("Executing payment on real ARC Testnet...");
        const paymentTx = await wizpay.routeAndPay(
            EURC,                   // tokenIn
            USDC,                   // tokenOut
            amountIn,               // amount
            minOut,                 // minAmountOut = 0
            RECIPIENT_ADDRESS       // recipient
        );

        const paymentReceipt = await paymentTx.wait();

        console.log("✅ Payment executed!");
        console.log("Block: " + paymentReceipt.blockNumber);
        console.log("Tx: " + paymentTx.hash);
        console.log("View: https://testnet.arcscan.app/tx/" + paymentTx.hash);
        console.log();

        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║  ✅ SUCCESS - Payment Completed                               ║");
        console.log("║                                                                ║");
        console.log("║  From: " + deployer.address + "  ║");
        console.log("║  To: " + RECIPIENT_ADDRESS + "  ║");
        console.log("║  Amount: " + AMOUNT_EURC + " EURC → ~" + expectedOutput + " USDC                    ║");
        console.log("║                                                                ║");
        console.log("║  Rate: 1 EUR = " + rate.toFixed(4) + " USD (real market data)                   ║");
        console.log("║  Transaction: https://testnet.arcscan.app/tx/                 ║");
        console.log("║  " + paymentTx.hash + "  ║");
        console.log("║                                                                ║");
        console.log("║  Verified on real ARC Testnet (Chain ID 5042002)               ║");
        console.log("╚════════════════════════════════════════════════════════════════╝");
        console.log();

    } catch (err) {
        console.error("❌ Payment failed:", err.message);
        console.error("\nTroubleshooting:");
        console.error("1. Check adapter liquidity (may need funding with more USDC)");
        console.error("2. Try a smaller payment amount");
        console.error("3. Ensure rate was updated successfully on the adapter");
        console.error("4. Verify recipient address is correct");
        console.error("\nAdapter Info:");
        console.error("  Adapter: " + ADAPTER_ADDRESS);
        console.error("  Max per transaction: ~0.1 EURC (testnet limitation)");
        console.error("  Status: Check USDC balance in explorer");
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error.message);
        process.exit(1);
    });
