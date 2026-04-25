import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

/**
 * Universal Flexible Payment Script
 * Send ANY token to ANY token with ANY amount
 * 
 * Usage (PowerShell):
 *   $env:FROM_TOKEN="EURC"; $env:TO_TOKEN="USDC"; $env:AMOUNT="0.5"; $env:RECIPIENT="0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484"; npx hardhat run scripts/universal-payment.js --network arc-testnet
 * 
 * Supported Tokens: EURC, USDC
 * Supported Pairs: EURC→USDC, USDC→EURC, EURC→EURC, USDC→USDC
 */
async function main() {
    // Get parameters from environment
    const fromTokenSymbol = process.env.FROM_TOKEN || "";
    const toTokenSymbol = process.env.TO_TOKEN || "";
    const amount = process.env.AMOUNT || "";
    const recipientAddress = process.env.RECIPIENT || "";

    // Show usage if missing params
    if (!fromTokenSymbol || !toTokenSymbol || !amount || !recipientAddress) {
        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║  WizPay Universal Payment Router                              ║");
        console.log("║  Send ANY token → ANY token                                    ║");
        console.log("╚════════════════════════════════════════════════════════════════╝\n");
        console.log("Usage (PowerShell):");
        console.log('  $env:FROM_TOKEN="EURC"; $env:TO_TOKEN="USDC"; $env:AMOUNT="0.5"; $env:RECIPIENT="0xef..."; npx hardhat run scripts/universal-payment.js --network arc-testnet\n');
        console.log("Parameters:");
        console.log("  FROM_TOKEN  Source token (EURC or USDC)");
        console.log("  TO_TOKEN    Destination token (EURC or USDC)");
        console.log("  AMOUNT      Amount to send");
        console.log("  RECIPIENT   Recipient address (0x...)\n");
        console.log("Examples:");
        console.log('  # EURC → USDC');
        console.log('  $env:FROM_TOKEN="EURC"; $env:TO_TOKEN="USDC"; $env:AMOUNT="0.5"; $env:RECIPIENT="0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484"; npx hardhat run scripts/universal-payment.js --network arc-testnet\n');
        console.log('  # USDC → EURC');
        console.log('  $env:FROM_TOKEN="USDC"; $env:TO_TOKEN="EURC"; $env:AMOUNT="1"; $env:RECIPIENT="0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484"; npx hardhat run scripts/universal-payment.js --network arc-testnet\n');
        console.log('  # Same token (USDC → USDC) - Direct transfer');
        console.log('  $env:FROM_TOKEN="USDC"; $env:TO_TOKEN="USDC"; $env:AMOUNT="5"; $env:RECIPIENT="0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484"; npx hardhat run scripts/universal-payment.js --network arc-testnet\n');
        process.exit(1);
    }

    const [deployer] = await hre.ethers.getSigners();

    // Token addresses
    const TOKENS = {
        EURC: process.env.ARC_EURC,
        USDC: process.env.ARC_USDC
    };

    const WIZPAY_ADDRESS = process.env.WIZPAY_ADDRESS;
    const ADAPTER_ADDRESS = process.env.STABLEFX_ADAPTER_ADDRESS;

    // Validate tokens
    if (!TOKENS[fromTokenSymbol] || !TOKENS[toTokenSymbol]) {
        console.error("❌ Invalid token! Supported: EURC, USDC");
        process.exit(1);
    }

    const fromToken = TOKENS[fromTokenSymbol];
    const toToken = TOKENS[toTokenSymbol];
    const isSameToken = fromToken.toLowerCase() === toToken.toLowerCase();

    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║  WizPay Universal Payment Router                              ║");
    console.log("║  " + fromTokenSymbol + " → " + toTokenSymbol + " Payment                                              ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    console.log("Configuration:");
    console.log("  Sender: " + deployer.address);
    console.log("  Recipient: " + recipientAddress);
    console.log("  From: " + amount + " " + fromTokenSymbol);
    console.log("  To: " + toTokenSymbol);
    console.log("  Mode: " + (isSameToken ? "Direct Transfer (Same Token)" : "Swap via Adapter"));
    console.log();

    // ============================================================
    // Step 1: Check Balances
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 1: Check Account Balances");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    const tokenABI = [
        "function balanceOf(address account) external view returns (uint256)",
        "function decimals() external view returns (uint8)",
        "function transfer(address to, uint256 amount) external returns (bool)",
        "function approve(address spender, uint256 amount) external returns (bool)"
    ];

    try {
        const fromTokenContract = new hre.ethers.Contract(fromToken, tokenABI, hre.ethers.provider);
        const fromDecimals = await fromTokenContract.decimals();
        const fromBalance = await fromTokenContract.balanceOf(deployer.address);
        const fromBalanceFormatted = hre.ethers.formatUnits(fromBalance, fromDecimals);

        console.log(fromTokenSymbol + " Balance: " + fromBalanceFormatted + " " + fromTokenSymbol);

        // Check if user has enough
        const amountNeeded = hre.ethers.parseUnits(amount, fromDecimals);
        if (fromBalance < amountNeeded) {
            console.error("❌ ERROR: Insufficient " + fromTokenSymbol + " balance!");
            console.error("   Need: " + amount + " " + fromTokenSymbol);
            console.error("   Have: " + fromBalanceFormatted + " " + fromTokenSymbol);
            process.exit(1);
        }
        console.log("✅ Sufficient " + fromTokenSymbol + " balance");
        console.log();

    } catch (err) {
        console.error("Error checking balances:", err.message);
        process.exit(1);
    }

    // ============================================================
    // Step 2: Handle Same-Token Transfer (Direct)
    // ============================================================
    if (isSameToken) {
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("Step 2: Direct Transfer (Same Token)");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log();

        try {
            const tokenContract = new hre.ethers.Contract(fromToken, tokenABI, deployer);
            const decimals = await tokenContract.decimals();
            const transferAmount = hre.ethers.parseUnits(amount, decimals);

            console.log("Transferring " + amount + " " + fromTokenSymbol + " directly to recipient...");
            const transferTx = await tokenContract.transfer(recipientAddress, transferAmount);
            const transferReceipt = await transferTx.wait();

            console.log("✅ Transfer completed!");
            console.log("Block: " + transferReceipt.blockNumber);
            console.log("Tx: " + transferTx.hash);
            console.log("View: https://testnet.arcscan.app/tx/" + transferTx.hash);
            console.log();

            console.log("╔════════════════════════════════════════════════════════════════╗");
            console.log("║  ✅ SUCCESS - Direct Transfer Completed                       ║");
            console.log("║                                                                ║");
            console.log("║  Amount: " + amount + " " + fromTokenSymbol + "                                              ║");
            console.log("║  From: " + deployer.address.substring(0, 20) + "...          ║");
            console.log("║  To: " + recipientAddress.substring(0, 20) + "...          ║");
            console.log("║                                                                ║");
            console.log("║  Transaction: https://testnet.arcscan.app/tx/                 ║");
            console.log("║  " + transferTx.hash + "  ║");
            console.log("║                                                                ║");
            console.log("║  Verified on real ARC Testnet (Chain ID 5042002)               ║");
            console.log("╚════════════════════════════════════════════════════════════════╝");
            console.log();

            process.exit(0);

        } catch (err) {
            console.error("❌ Transfer failed:", err.message);
            process.exit(1);
        }
    }

    // ============================================================
    // Step 3: Fetch Exchange Rate (for swaps)
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 2: Fetch Exchange Rate");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    let rate = 1.16;
    let inverseRate = 1 / 1.16;

    try {
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
        const data = await response.json();
        rate = data.rates.USD;
        inverseRate = 1 / rate;
        
        if (fromTokenSymbol === "EURC" && toTokenSymbol === "USDC") {
            console.log("Real Rate: 1 EUR = " + rate.toFixed(4) + " USD");
        } else if (fromTokenSymbol === "USDC" && toTokenSymbol === "EURC") {
            console.log("Real Rate: 1 USD = " + inverseRate.toFixed(4) + " EUR");
        }
        console.log("Source: Exchangerate-API (official financial data)");
    } catch (err) {
        console.warn("Warning: Could not fetch live rate, using default");
    }
    console.log();

    // ============================================================
    // Step 4: Update Rate on Adapter
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 3: Update Rate on Adapter");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const adapterABI = ["function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external"];
        const adapter = new hre.ethers.Contract(ADAPTER_ADDRESS, adapterABI, deployer);

        // Determine which rate to set
        const rateToSet = (fromTokenSymbol === "EURC") ? rate : inverseRate;
        const rateInWei = hre.ethers.parseUnits(rateToSet.toFixed(4), 18);
        
        const rateTx = await adapter.setExchangeRate(fromToken, toToken, rateInWei);
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
    // Step 5: Approve Tokens
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 4: Approve " + amount + " " + fromTokenSymbol + " to WizPay");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const fromTokenContract = new hre.ethers.Contract(fromToken, tokenABI, deployer);
        const decimals = await fromTokenContract.decimals();
        const approveAmount = hre.ethers.parseUnits(amount, decimals);

        console.log("Approving " + amount + " " + fromTokenSymbol + "...");
        const approveTx = await fromTokenContract.approve(WIZPAY_ADDRESS, approveAmount);
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
    // Step 6: Execute Payment via WizPay
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 5: Execute Swap Payment");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const wizpayABI = [
            "function routeAndPay(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient) external"
        ];
        const wizpay = new hre.ethers.Contract(WIZPAY_ADDRESS, wizpayABI, deployer);

        const fromTokenContract = new hre.ethers.Contract(fromToken, tokenABI, hre.ethers.provider);
        const decimals = await fromTokenContract.decimals();
        const amountIn = hre.ethers.parseUnits(amount, decimals);
        const minOut = 0n; // Let adapter handle slippage

        const rateToUse = (fromTokenSymbol === "EURC") ? rate : inverseRate;
        const expectedOutput = (rateToUse * parseFloat(amount)).toFixed(4);

        console.log("Payment Details:");
        console.log("  From: " + deployer.address);
        console.log("  To: " + recipientAddress);
        console.log("  Input: " + amount + " " + fromTokenSymbol);
        console.log("  Expected Output: ~" + expectedOutput + " " + toTokenSymbol);
        console.log();

        console.log("Executing payment on real ARC Testnet...");
        const paymentTx = await wizpay.routeAndPay(
            fromToken,
            toToken,
            amountIn,
            minOut,
            recipientAddress
        );

        const paymentReceipt = await paymentTx.wait();

        console.log("✅ Payment executed!");
        console.log("Block: " + paymentReceipt.blockNumber);
        console.log("Tx: " + paymentTx.hash);
        console.log("View: https://testnet.arcscan.app/tx/" + paymentTx.hash);
        console.log();

        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║  ✅ SUCCESS - Swap Payment Completed                          ║");
        console.log("║                                                                ║");
        console.log("║  Amount: " + amount + " " + fromTokenSymbol + " → ~" + expectedOutput + " " + toTokenSymbol + "                    ║");
        console.log("║                                                                ║");
        console.log("║  Transaction: https://testnet.arcscan.app/tx/                 ║");
        console.log("║  " + paymentTx.hash + "  ║");
        console.log("║                                                                ║");
        console.log("║  Verified on real ARC Testnet (Chain ID 5042002)               ║");
        console.log("╚════════════════════════════════════════════════════════════════╝");
        console.log();

    } catch (err) {
        console.error("❌ Payment failed:", err.message);
        console.error("\nTroubleshooting:");
        console.error("1. Check adapter liquidity (may be depleted)");
        console.error("2. Try a smaller amount");
        console.error("3. For same-token transfers, script uses direct transfer");
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
