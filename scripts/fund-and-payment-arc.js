import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

/**
 * Check Adapter USDC Balance and Fund if Needed
 * Then Execute Payment
 */
async function main() {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║  Check Adapter Liquidity and Fund if Needed                    ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await hre.ethers.getSigners();

    const ADAPTER_ADDRESS = process.env.STABLEFX_ADAPTER_ADDRESS;
    const WIZPAY_ADDRESS = process.env.WIZPAY_ADDRESS;
    const EURC = process.env.ARC_EURC;
    const USDC = process.env.ARC_USDC;

    console.log("Account: " + deployer.address);
    console.log("Adapter: " + ADAPTER_ADDRESS);
    console.log();

    // ============================================================
    // Step 1: Check adapter USDC balance
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 1: Check Adapter USDC Balance");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    const usdcABI = ["function balanceOf(address account) external view returns (uint256)"];
    const usdc = new hre.ethers.Contract(USDC, usdcABI, deployer);

    const adapterBalance = await usdc.balanceOf(ADAPTER_ADDRESS);
    const adapterBalanceFormatted = hre.ethers.formatUnits(adapterBalance, 18);

    console.log("Adapter USDC Balance: " + adapterBalanceFormatted + " USDC");

    if (adapterBalance < hre.ethers.parseUnits("2", 18)) {
        console.log("⚠️  Low liquidity! Need to fund adapter");
        console.log();

        // ============================================================
        // Step 2: Fund adapter with USDC
        // ============================================================
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("Step 2: Fund Adapter with USDC");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log();

        try {
            // Check deployer balance
            const deployerBalance = await usdc.balanceOf(deployer.address);
            console.log("Deployer USDC balance: " + hre.ethers.formatUnits(deployerBalance, 18) + " USDC");

            // Use 50% of available balance to fund adapter
            const fundAmount = deployerBalance > 0n ? deployerBalance / 2n : 0n;
            
            if (fundAmount === 0n) {
                console.log("⚠️  Deployer has insufficient USDC balance to fund");
                console.log("    Account needs USDC testnet tokens");
                process.exit(1);
            }

            console.log("Sending " + hre.ethers.formatUnits(fundAmount, 18) + " USDC to adapter...");

            const usdcTransferABI = ["function transfer(address to, uint256 amount) external returns (bool)"];
            const usdcTransfer = new hre.ethers.Contract(USDC, usdcTransferABI, deployer);

            const fundTx = await usdcTransfer.transfer(ADAPTER_ADDRESS, fundAmount);
            const fundReceipt = await fundTx.wait();

            console.log("✅ Funded on ARC Testnet");
            console.log("Block: " + fundReceipt.blockNumber);
            console.log("Tx: " + fundTx.hash);
            console.log("View: https://testnet.arcscan.app/tx/" + fundTx.hash);
            console.log();

            // Verify new balance
            const newBalance = await usdc.balanceOf(ADAPTER_ADDRESS);
            console.log("New adapter balance: " + hre.ethers.formatUnits(newBalance, 18) + " USDC");
            console.log();

        } catch (err) {
            console.error("Error funding adapter:", err.message);
            process.exit(1);
        }
    } else {
        console.log("✅ Sufficient liquidity in adapter");
        console.log();
    }

    // ============================================================
    // Step 3: Update exchange rate
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 3: Update Exchange Rate");
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
        console.log("Updating rate on adapter...");
        const rateTx = await adapter.setExchangeRate(EURC, USDC, rateInWei);

        const rateReceipt = await rateTx.wait();
        console.log("✅ Rate updated");
        console.log("Tx: " + rateTx.hash);
        console.log();

    } catch (err) {
        console.error("Error updating rate:", err.message);
        process.exit(1);
    }

    // ============================================================
    // Step 4: Approve EURC
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 4: Approve EURC to WizPay");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        const eurcABI = ["function approve(address spender, uint256 amount) external returns (bool)"];
        const eurc = new hre.ethers.Contract(EURC, eurcABI, deployer);

        const approveAmount = hre.ethers.parseUnits("1", 6);
        console.log("Approving 1 EURC...");
        const approveTx = await eurc.approve(WIZPAY_ADDRESS, approveAmount);

        const approveReceipt = await approveTx.wait();
        console.log("✅ Approved");
        console.log("Tx: " + approveTx.hash);
        console.log();

    } catch (err) {
        console.error("Error approving:", err.message);
        process.exit(1);
    }

    // ============================================================
    // Step 5: Execute payment
    // ============================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 5: Execute Payment");
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

        const amountIn = hre.ethers.parseUnits("1", 6);
        const minAmountOut = 0n;

        console.log("Payment:");
        console.log("  Input: 1 EURC");
        console.log("  Rate: 1 EUR = " + rate.toFixed(4) + " USD");
        console.log("  Expected Output: ~" + rate.toFixed(4) + " USDC");
        console.log();

        console.log("Executing payment...");
        const paymentTx = await wizpay.routeAndPay(
            EURC,
            USDC,
            amountIn,
            minAmountOut,
            deployer.address
        );

        const paymentReceipt = await paymentTx.wait();

        console.log("✅ Payment executed!");
        console.log("Block: " + paymentReceipt.blockNumber);
        console.log("Tx: " + paymentTx.hash);
        console.log("View: https://testnet.arcscan.app/tx/" + paymentTx.hash);
        console.log();

        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║  ✅ SUCCESS - Real ARC Testnet Payment Complete               ║");
        console.log("║                                                                ║");
        console.log("║  All transactions verified on ARC Explorer                    ║");
        console.log("║  https://testnet.arcscan.app                                   ║");
        console.log("╚════════════════════════════════════════════════════════════════╝");
        console.log();

    } catch (err) {
        console.error("Error executing payment:", err.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error.message);
        process.exit(1);
    });
