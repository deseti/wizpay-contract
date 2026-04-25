import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

/**
 * Simplified Payment Flow Test
 * Focus on payment execution without querying token balances initially
 */
async function main() {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║        Testing Payment with Real Rates & Liquidity             ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deployer:", deployer.address);
    console.log();

    // Addresses
    const WIZPAY_ADDRESS = process.env.WIZPAY_ADDRESS;
    const ADAPTER_ADDRESS = process.env.STABLEFX_ADAPTER_ADDRESS;
    const EURC = process.env.ARC_EURC;
    const USDC = process.env.ARC_USDC;
    const USER_WALLET = "0x75b0b8EFb946e2892Bc650311D28DEFfbe015Ea9";

    console.log("📍 Addresses:");
    console.log("   WizPay:", WIZPAY_ADDRESS);
    console.log("   Adapter:", ADAPTER_ADDRESS);
    console.log("   EURC:", EURC);
    console.log("   USDC:", USDC);
    console.log();

    // ============================================================
    // Step 1: Fetch and set real rate
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 1: Fetch Real EUR/USD Rate");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
        const data = await response.json();
        const realRate = data.rates.USD;
        
        console.log("✅ Real EUR/USD Rate: " + realRate.toFixed(4));
        console.log("   Source: Exchangerate-API (Official)");
        console.log("   Timestamp:", new Date().toISOString());
        console.log();
        
        // Set rate on adapter
        const adapterABI = ["function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external"];
        const adapter = new hre.ethers.Contract(ADAPTER_ADDRESS, adapterABI, deployer);
        
        const rateInWei = hre.ethers.parseUnits(realRate.toFixed(4), 18);
        console.log("Setting rate on adapter contract...");
        const rateTx = await adapter.setExchangeRate(EURC, USDC, rateInWei);
        const rateReceipt = await rateTx.wait();
        console.log("✅ Rate set at block", rateReceipt.blockNumber);
        console.log("   Tx:", rateTx.hash);
        console.log();

    } catch (err) {
        console.error("❌ Rate update failed:", err.message);
        process.exit(1);
    }

    // ============================================================
    // Step 2: Add Liquidity to Adapter
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 2: Add USDC Liquidity to Adapter");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const adapterABI = [
            "function addLiquidity(address token, uint256 amount) external"
        ];
        
        const usdcABI = [
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function transfer(address to, uint256 amount) external returns (bool)"
        ];
        
        const adapter = new hre.ethers.Contract(ADAPTER_ADDRESS, adapterABI, deployer);
        const usdc = new hre.ethers.Contract(USDC, usdcABI, deployer);
        
        const fundAmount = hre.ethers.parseUnits("50", 18); // 50 USDC
        
        console.log("Funding adapter with", hre.ethers.formatUnits(fundAmount, 18), "USDC...");
        
        // Direct transfer (for native USDC)
        const transferTx = await usdc.transfer(ADAPTER_ADDRESS, fundAmount);
        const transferReceipt = await transferTx.wait();
        console.log("✅ Liquidity transferred at block", transferReceipt.blockNumber);
        console.log("   Tx:", transferTx.hash);
        console.log();

    } catch (err) {
        console.error("⚠️  Liquidity addition note:", err.message);
        console.log("   Continuing with payment test...");
        console.log();
    }

    // ============================================================
    // Step 3: Execute Payment
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 3: Execute Payment Transaction");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        // Impersonate user
        console.log("Impersonating user:", USER_WALLET);
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [USER_WALLET],
        });
        
        const userSigner = await hre.ethers.getSigner(USER_WALLET);
        console.log("✅ User wallet ready");
        console.log();

        // ABIs
        const wizpayABI = [
            "function routeAndPay(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient) external"
        ];
        
        const eurcABI = [
            "function approve(address spender, uint256 amount) external returns (bool)"
        ];

        // Get contract instances with user signer
        const wizpay = new hre.ethers.Contract(WIZPAY_ADDRESS, wizpayABI, userSigner);
        const eurc = new hre.ethers.Contract(EURC, eurcABI, userSigner);

        // Payment parameters
        const paymentAmount = hre.ethers.parseUnits("1", 6); // 1 EURC (6 decimals)
        const minAmountOut = hre.ethers.parseUnits("1.1", 18); // Min 1.1 USDC with slippage

        console.log("Payment parameters:");
        console.log("  Input: 1 EURC");
        console.log("  Expected Output: ~1.16 USDC");
        console.log("  Minimum Output:", hre.ethers.formatUnits(minAmountOut, 18), "USDC");
        console.log();

        // Step 1: Approve EURC
        console.log("Step 3a: Approving EURC...");
        const approveTx = await eurc.approve(WIZPAY_ADDRESS, paymentAmount);
        const approveReceipt = await approveTx.wait();
        console.log("✅ Approved at block", approveReceipt.blockNumber);
        console.log("   Tx:", approveTx.hash);
        console.log();

        // Step 2: Execute payment
        console.log("Step 3b: Executing payment via WizPay...");
        const paymentTx = await wizpay.routeAndPay(
            EURC,
            USDC,
            paymentAmount,
            minAmountOut,
            USER_WALLET
        );
        
        const paymentReceipt = await paymentTx.wait();
        console.log("✅ Payment executed at block", paymentReceipt.blockNumber);
        console.log("   Tx:", paymentTx.hash);
        console.log();

        // Show success
        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║  ✅ SUCCESS: PAYMENT EXECUTED WITH REAL MARKET RATES!          ║");
        console.log("╚════════════════════════════════════════════════════════════════╝");
        console.log();
        console.log("📊 Payment Summary:");
        console.log("   Amount: 1 EURC → ~1.16 USDC");
        console.log("   Rate Source: Official Exchangerate-API");
        console.log("   Network: ARC Testnet");
        console.log("   Chain: Circle's Stablecoin Settlement Chain");
        console.log();
        console.log("📝 Transaction Details:");
        console.log("   Approval Tx:", approveReceipt.transactionHash);
        console.log("   Payment Tx:", paymentReceipt.transactionHash);
        console.log();

    } catch (err) {
        console.error("❌ Payment failed:", err.message);
        
        // Try to extract more details
        if (err.reason) console.error("   Reason:", err.reason);
        if (err.code) console.error("   Code:", err.code);
        
        // Check if it's liquidity error
        if (err.message.includes("Insufficient liquidity")) {
            console.log();
            console.log("ℹ️  Solution: More USDC liquidity needed in adapter");
            console.log("   Run: node scripts/fund-adapter-simple.js");
            console.log("   Then: node scripts/full-payment-simple.js");
        }
        
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script error:", error);
        process.exit(1);
    });
