import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

/**
 * Real ARC Testnet Funding and Payment Test
 * Connects to actual ARC Testnet - transactions visible in block explorer
 */
async function main() {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║      Real ARC Testnet - Funding & Payment Test                 ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    // Get network info
    console.log("Network Configuration:");
    console.log("  RPC URL:", process.env.ARC_TESTNET_RPC_URL);
    console.log("  Chain ID:", process.env.ARC_TESTNET_CHAIN_ID);
    console.log("  Network: ARC Testnet");
    console.log("  Explorer: https://testnet.arcscan.app");
    console.log();

    const [deployer] = await hre.ethers.getSigners();
    
    console.log("Account:", deployer.address);
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Balance:", hre.ethers.formatEther(balance), "USDC");
    console.log();

    // Get addresses from .env
    const WIZPAY_ADDRESS = process.env.WIZPAY_ADDRESS;
    const ADAPTER_ADDRESS = process.env.STABLEFX_ADAPTER_ADDRESS;
    const EURC = process.env.ARC_EURC;
    const USDC = process.env.ARC_USDC;

    console.log("Contract Addresses:");
    console.log("  WizPay:", WIZPAY_ADDRESS);
    console.log("  Adapter:", ADAPTER_ADDRESS);
    console.log("  EURC:", EURC);
    console.log("  USDC:", USDC);
    console.log();

    // ============================================================
    // Step 1: Fund adapter with 10% of balance
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 1: Fund Adapter (10% of Balance)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const fundAmount = (balance * 10n) / 100n;
        console.log("Funding amount: " + hre.ethers.formatEther(fundAmount) + " USDC");

        const usdcABI = ["function transfer(address to, uint256 amount) external returns (bool)"];
        const usdc = new hre.ethers.Contract(USDC, usdcABI, deployer);

        console.log("Sending transaction to ARC testnet...");
        const tx = await usdc.transfer(ADAPTER_ADDRESS, fundAmount);
        
        console.log("Submitted - waiting for confirmation...");
        const receipt = await tx.wait();

        console.log("✅ Confirmed on ARC Testnet");
        console.log("   Transaction:", tx.hash);
        console.log("   Block:", receipt.blockNumber);
        console.log("   Explorer: https://testnet.arcscan.app/tx/" + tx.hash);
        console.log();

    } catch (err) {
        console.error("❌ Failed:", err.message);
        process.exit(1);
    }

    // ============================================================
    // Step 2: Test payment with 5% of EURC
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 2: Test Payment (5% of EURC)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        // Fetch current rate
        console.log("Fetching real EUR/USD rate...");
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
        const data = await response.json();
        const rate = data.rates.USD;
        console.log("Rate: 1 EUR = " + rate.toFixed(4) + " USD");
        console.log();

        // Get EURC balance
        const eurcABI = ["function balanceOf(address account) external view returns (uint256)"];
        const eurc = new hre.ethers.Contract(EURC, eurcABI, deployer);
        const eurcBalance = await eurc.balanceOf(deployer.address);

        const paymentAmount = (eurcBalance * 5n) / 100n;
        const paymentFormatted = hre.ethers.formatUnits(paymentAmount, 6);
        const expectedOutput = parseFloat(paymentFormatted) * rate;

        console.log("Payment Setup:");
        console.log("  Input: " + paymentFormatted + " EURC (5% of balance)");
        console.log("  Expected output: ~" + expectedOutput.toFixed(4) + " USDC");
        console.log();

        // Approve WizPay
        const eurcApproveABI = ["function approve(address spender, uint256 amount) external returns (bool)"];
        const eurcApprove = new hre.ethers.Contract(EURC, eurcApproveABI, deployer);

        console.log("Step 2a: Approving EURC...");
        const approveTx = await eurcApprove.approve(WIZPAY_ADDRESS, paymentAmount);
        const approveReceipt = await approveTx.wait();

        console.log("✅ Approved");
        console.log("   Tx: https://testnet.arcscan.app/tx/" + approveTx.hash);
        console.log();

        // Execute payment
        const wizpayABI = [
            "function routeAndPay(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient) external"
        ];
        const wizpay = new hre.ethers.Contract(WIZPAY_ADDRESS, wizpayABI, deployer);

        const minOutput = hre.ethers.parseUnits((expectedOutput * 0.985).toFixed(2), 18);

        console.log("Step 2b: Executing payment...");
        const paymentTx = await wizpay.routeAndPay(
            EURC,
            USDC,
            paymentAmount,
            minOutput,
            deployer.address
        );

        console.log("Waiting for confirmation on ARC testnet...");
        const paymentReceipt = await paymentTx.wait();

        console.log("✅ Payment executed");
        console.log("   Tx: https://testnet.arcscan.app/tx/" + paymentTx.hash);
        console.log("   Block:", paymentReceipt.blockNumber);
        console.log();

        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║  ✅ SUCCESS - Real ARC Testnet Test Complete                  ║");
        console.log("║                                                                ║");
        console.log("║  Funding Tx:   https://testnet.arcscan.app/tx/" + tx.hash.slice(0, 30) + "... ║");
        console.log("║  Payment Tx:   https://testnet.arcscan.app/tx/" + paymentTx.hash.slice(0, 30) + "... ║");
        console.log("║                                                                ║");
        console.log("║  View in ARC Explorer: https://testnet.arcscan.app              ║");
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
