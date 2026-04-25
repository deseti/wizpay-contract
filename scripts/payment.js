import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

/**
 * Truly Flexible WizPay Payment Script
 * Configure using environment variables
 * 
 * Usage:
 *   AMOUNT=0.1 RECIPIENT=0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484 npx hardhat run scripts/payment.js --network arc-testnet
 * 
 * Or in PowerShell:
 *   $env:AMOUNT="0.1"; $env:RECIPIENT="0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484"; npx hardhat run scripts/payment.js --network arc-testnet
 */
async function main() {
    // Get amount and recipient from environment variables
    const amountEurc = process.env.AMOUNT;
    const recipientAddress = process.env.RECIPIENT;

    // Show usage if not provided
    if (!amountEurc || !recipientAddress) {
        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║  WizPay Flexible Payment Router - EURC → USDC                  ║");
        console.log("╚════════════════════════════════════════════════════════════════╝\n");
        console.log("Usage (PowerShell):");
        console.log('  $env:AMOUNT="0.1"; $env:RECIPIENT="0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484"; npx hardhat run scripts/payment.js --network arc-testnet\n');
        console.log("Usage (Linux/Mac/Git Bash):");
        console.log('  AMOUNT=0.1 RECIPIENT=0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484 npx hardhat run scripts/payment.js --network arc-testnet\n');
        console.log("Parameters:");
        console.log("  AMOUNT     Amount of EURC to send (e.g., 0.1, 0.05, 0.01)");
        console.log("  RECIPIENT  Recipient wallet address (0x...)\n");
        console.log("Examples (PowerShell):");
        console.log('  $env:AMOUNT="0.1"; $env:RECIPIENT="0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484"; npx hardhat run scripts/payment.js --network arc-testnet');
        console.log('  $env:AMOUNT="0.05"; $env:RECIPIENT="0x1234567890123456789012345678901234567890"; npx hardhat run scripts/payment.js --network arc-testnet\n');
        console.log("Note:");
        console.log("  Testnet adapter has liquidity limit of ~0.1 EURC per transaction");
        console.log("  Amounts > 0.1 EURC will likely fail due to adapter liquidity");
        process.exit(1);
    }

    const [deployer] = await hre.ethers.getSigners();

    const WIZPAY_ADDRESS = process.env.WIZPAY_ADDRESS;
    const ADAPTER_ADDRESS = process.env.STABLEFX_ADAPTER_ADDRESS;
    const EURC = process.env.ARC_EURC;
    const USDC = process.env.ARC_USDC;

    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║  WizPay Flexible Payment Router                               ║");
    console.log("║  Send " + amountEurc + " EURC → USDC                                        ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    console.log("Configuration:");
    console.log("  Sender: " + deployer.address);
    console.log("  Recipient: " + recipientAddress);
    console.log("  Amount: " + amountEurc + " EURC");
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
        const amountNeeded = hre.ethers.parseUnits(amountEurc, eurcDecimals);
        if (eurcBalance < amountNeeded) {
            console.error("❌ ERROR: Insufficient EURC balance!");
            console.error("   Need: " + amountEurc + " EURC");
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
    console.log("Step 4: Approve " + amountEurc + " EURC to WizPay");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const eurcABI = ["function approve(address spender, uint256 amount) external returns (bool)"];
        const eurc = new hre.ethers.Contract(EURC, eurcABI, deployer);

        const approveAmount = hre.ethers.parseUnits(amountEurc, 6);
        console.log("Approving " + amountEurc + " EURC...");

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

        const amountIn = hre.ethers.parseUnits(amountEurc, 6);
        const minOut = 0n; // Let adapter handle slippage
        const expectedOutput = (rate * parseFloat(amountEurc)).toFixed(4);

        console.log("Payment Details:");
        console.log("  From: " + deployer.address);
        console.log("  To: " + recipientAddress);
        console.log("  Input: " + amountEurc + " EURC");
        console.log("  Rate: 1 EUR = " + rate.toFixed(4) + " USD");
        console.log("  Expected Output: ~" + expectedOutput + " USDC");
        console.log();

        console.log("Executing payment on real ARC Testnet...");
        const paymentTx = await wizpay.routeAndPay(
            EURC,                   // tokenIn
            USDC,                   // tokenOut
            amountIn,               // amount
            minOut,                 // minAmountOut = 0
            recipientAddress        // recipient
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
        console.log("║  From: " + deployer.address.substring(0, 20) + "...          ║");
        console.log("║  To: " + recipientAddress.substring(0, 20) + "...          ║");
        console.log("║  Amount: " + amountEurc + " EURC → ~" + expectedOutput + " USDC                    ║");
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
        console.error("1. Check adapter liquidity (USDC balance may be low)");
        console.error("2. Try a smaller payment amount (testnet limit ~0.1 EURC)");
        console.error("3. Ensure rate was updated successfully on the adapter");
        console.error("4. Verify recipient address is correct");
        console.error("\nAdapter Info:");
        console.error("  Adapter: " + ADAPTER_ADDRESS);
        console.error("  Explorer: https://testnet.arcscan.app/address/" + ADAPTER_ADDRESS);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error.message);
        process.exit(1);
    });
