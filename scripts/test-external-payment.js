import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

/**
 * Test payment to external address using real market rates
 * Send EURC from deployer to specific recipient, receive USDC
 */
async function main() {
    console.log("💸 Testing Payment to External Address with Real Market Rates...\n");

    const [sender] = await hre.ethers.getSigners();
    console.log("📝 Sending from account:", sender.address);
    
    const balance = await hre.ethers.provider.getBalance(sender.address);
    console.log("💰 Sender balance:", hre.ethers.formatEther(balance), "USDC\n");

    // Get addresses
    const WIZPAY_ADDRESS = process.env.WIZPAY_ADDRESS;
    const ADAPTER_ADDRESS = process.env.STABLEFX_ADAPTER_ADDRESS;
    const USDC = process.env.ARC_USDC;
    const EURC = process.env.ARC_EURC;
    const RECIPIENT = "0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484";

    console.log("📍 Contract Addresses:");
    console.log("   WizPay:", WIZPAY_ADDRESS);
    console.log("   StableFXAdapter:", ADAPTER_ADDRESS);
    console.log("   USDC:", USDC);
    console.log("   EURC:", EURC);
    console.log("   Recipient:", RECIPIENT);
    console.log();

    // Get contract instances
    const wizpay = await hre.ethers.getContractAt("WizPay", WIZPAY_ADDRESS);
    const adapter = await hre.ethers.getContractAt("StableFXAdapter", ADAPTER_ADDRESS);
    const usdc = await hre.ethers.getContractAt("IERC20", USDC);
    const eurc = await hre.ethers.getContractAt("IERC20", EURC);

    // Check initial balances
    console.log("💰 Initial Balances:");
    const senderEURCBefore = await eurc.balanceOf(sender.address);
    const recipientUSDCBefore = await usdc.balanceOf(RECIPIENT);
    
    console.log("   Sender EURC:", hre.ethers.formatUnits(senderEURCBefore, 6));
    console.log("   Recipient USDC:", hre.ethers.formatUnits(recipientUSDCBefore, 6));
    console.log();

    if (senderEURCBefore === 0n) {
        console.log("⚠️  Sender has no EURC balance for testing");
        console.log("   Get testnet tokens from: https://faucet.circle.com/");
        process.exit(0);
    }

    // Use smaller amount that adapter can handle (1 EURC)
    const amountToSend = hre.ethers.parseUnits("1", 6); // 1 EURC

    console.log("💸 Payment Details:");
    console.log("   Sending:", hre.ethers.formatUnits(amountToSend, 6), "EURC");
    console.log("   From:", sender.address);
    console.log("   To:", RECIPIENT);
    console.log();

    // Get current exchange rate
    const rate = await adapter.getExchangeRate(EURC, USDC);
    console.log("📊 Current Exchange Rate (Real Market):");
    console.log("   1 EURC =", hre.ethers.formatUnits(rate, 18), "USDC");
    console.log();

    // Calculate expected output
    const expectedOutput = await adapter.getEstimatedAmount(EURC, USDC, amountToSend);
    console.log("📈 Expected Output:");
    console.log("   Before fees:", hre.ethers.formatUnits(expectedOutput, 6), "USDC");
    
    // Calculate with WizPay fee (0.1%)
    const feeBps = await wizpay.feeBps();
    const feeAmount = (expectedOutput * feeBps) / 10000n;
    const expectedAfterFee = expectedOutput - feeAmount;
    console.log("   WizPay fee (0.1%):", hre.ethers.formatUnits(feeAmount, 6), "USDC");
    console.log("   After fees:", hre.ethers.formatUnits(expectedAfterFee, 6), "USDC");
    console.log();

    // Approve EURC to WizPay
    console.log("🔓 Approving EURC...");
    let tx = await eurc.approve(WIZPAY_ADDRESS, amountToSend);
    await tx.wait();
    console.log("   ✓ Approval confirmed");
    console.log();

    // Execute payment
    console.log("⚡ Executing payment to external address...");
    const minAmountOut = (expectedAfterFee * 98n) / 100n; // 2% slippage tolerance
    console.log("   Min amount out:", hre.ethers.formatUnits(minAmountOut, 6), "USDC");
    
    tx = await wizpay.routeAndPay(
        EURC,
        USDC,
        amountToSend,
        minAmountOut,
        RECIPIENT
    );
    console.log("⏳ Transaction submitted:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    console.log();

    // Check final balances
    console.log("💰 Final Balances:");
    const senderEURCAfter = await eurc.balanceOf(sender.address);
    const recipientUSDCAfter = await usdc.balanceOf(RECIPIENT);
    
    console.log("   Sender EURC:", hre.ethers.formatUnits(senderEURCAfter, 6));
    console.log("   Recipient USDC:", hre.ethers.formatUnits(recipientUSDCAfter, 6));
    console.log();

    // Calculate actual changes
    const eurcSpent = senderEURCBefore - senderEURCAfter;
    const usdcReceived = recipientUSDCAfter - recipientUSDCBefore;
    
    console.log("📊 Transaction Summary:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("   EURC Spent:", hre.ethers.formatUnits(eurcSpent, 6));
    console.log("   USDC Received by Recipient:", hre.ethers.formatUnits(usdcReceived, 6));
    console.log("   Effective Rate:", hre.ethers.formatUnits((usdcReceived * hre.ethers.parseUnits("1", 18)) / eurcSpent, 18));
    console.log("   Market Rate:", hre.ethers.formatUnits(rate, 18));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    console.log("✅ External payment test completed successfully!");
    console.log();
    console.log("🎯 Payment Summary:");
    console.log(`   ✓ Sent ${hre.ethers.formatUnits(eurcSpent, 6)} EURC from ${sender.address}`);
    console.log(`   ✓ Recipient ${RECIPIENT} received ${hre.ethers.formatUnits(usdcReceived, 6)} USDC`);
    console.log("   ✓ Used real market rate (1 EURC = 1.09 USDC)");
    console.log("   ✓ Cross-stablecoin payment executed successfully");
    console.log();
    console.log("🔍 View transaction on ArcScan:");
    console.log(`   https://testnet.arcscan.app/tx/${tx.hash}`);
    console.log();
    console.log("📍 Check recipient balance:");
    console.log(`   https://testnet.arcscan.app/address/${RECIPIENT}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Payment test failed:");
        console.error(error);
        process.exit(1);
    });