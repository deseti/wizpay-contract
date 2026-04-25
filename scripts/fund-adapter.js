import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

/**
 * Fund StableFXAdapter with liquidity for instant swaps
 */
async function main() {
    console.log("💧 Funding StableFXAdapter with liquidity...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Funding with account:", deployer.address);
    
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(balance), "USDC\n");

    // Get addresses from .env
    const ADAPTER_ADDRESS = process.env.STABLEFX_ADAPTER_ADDRESS;
    const USDC = process.env.ARC_USDC;
    const EURC = process.env.ARC_EURC;
    const USYC = process.env.ARC_USYC;

    if (!ADAPTER_ADDRESS) {
        console.error("❌ STABLEFX_ADAPTER_ADDRESS not found in .env");
        console.log("   Deploy the adapter first using: node scripts/deploy-stablefx-adapter.js");
        process.exit(1);
    }

    console.log("📍 Contract Addresses:");
    console.log("   Adapter:", ADAPTER_ADDRESS);
    console.log("   USDC:", USDC);
    console.log("   EURC:", EURC);
    console.log("   USYC:", USYC);
    console.log();

    // Get contract instances
    const adapter = await hre.ethers.getContractAt("StableFXAdapter", ADAPTER_ADDRESS);
    const usdc = await hre.ethers.getContractAt("IERC20", USDC);
    const eurc = await hre.ethers.getContractAt("IERC20", EURC);
    const usyc = await hre.ethers.getContractAt("IERC20", USYC);

    // Check current balances
    console.log("💰 Current Balances:");
    const usdcBalance = await usdc.balanceOf(deployer.address);
    const eurcBalance = await eurc.balanceOf(deployer.address);
    const usycBalance = await usyc.balanceOf(deployer.address);
    
    console.log("   USDC:", hre.ethers.formatUnits(usdcBalance, 6));
    console.log("   EURC:", hre.ethers.formatUnits(eurcBalance, 6));
    console.log("   USYC:", hre.ethers.formatUnits(usycBalance, 6));
    console.log();

    // Determine funding amounts (use available balances)
    const usdcToFund = usdcBalance > 0n ? usdcBalance / 2n : 0n; // Fund 50% of USDC
    const eurcToFund = eurcBalance > 0n ? eurcBalance / 2n : 0n; // Fund 50% of EURC
    const usycToFund = usycBalance > 0n ? usycBalance / 2n : 0n; // Fund 50% of USYC

    console.log("📦 Funding Amounts:");
    console.log("   USDC:", hre.ethers.formatUnits(usdcToFund, 6));
    console.log("   EURC:", hre.ethers.formatUnits(eurcToFund, 6));
    console.log("   USYC:", hre.ethers.formatUnits(usycToFund, 6));
    console.log();

    let fundedCount = 0;

    // Fund USDC
    if (usdcToFund > 0n) {
        console.log("💧 Funding USDC...");
        let tx = await usdc.approve(ADAPTER_ADDRESS, usdcToFund);
        await tx.wait();
        console.log("   ✓ USDC approved");
        
        tx = await adapter.addLiquidity(USDC, usdcToFund);
        await tx.wait();
        console.log("   ✓ USDC liquidity added");
        fundedCount++;
    } else {
        console.log("⚠️  Skipping USDC (insufficient balance)");
    }
    console.log();

    // Fund EURC
    if (eurcToFund > 0n) {
        console.log("💧 Funding EURC...");
        let tx = await eurc.approve(ADAPTER_ADDRESS, eurcToFund);
        await tx.wait();
        console.log("   ✓ EURC approved");
        
        tx = await adapter.addLiquidity(EURC, eurcToFund);
        await tx.wait();
        console.log("   ✓ EURC liquidity added");
        fundedCount++;
    } else {
        console.log("⚠️  Skipping EURC (insufficient balance)");
    }
    console.log();

    // Fund USYC
    if (usycToFund > 0n) {
        console.log("💧 Funding USYC...");
        let tx = await usyc.approve(ADAPTER_ADDRESS, usycToFund);
        await tx.wait();
        console.log("   ✓ USYC approved");
        
        tx = await adapter.addLiquidity(USYC, usycToFund);
        await tx.wait();
        console.log("   ✓ USYC liquidity added");
        fundedCount++;
    } else {
        console.log("⚠️  Skipping USYC (insufficient balance)");
    }
    console.log();

    // Check adapter liquidity
    console.log("📊 Adapter Liquidity Status:");
    const adapterUSDC = await adapter.getLiquidity(USDC);
    const adapterEURC = await adapter.getLiquidity(EURC);
    const adapterUSYC = await adapter.getLiquidity(USYC);
    
    console.log("   USDC:", hre.ethers.formatUnits(adapterUSDC, 6));
    console.log("   EURC:", hre.ethers.formatUnits(adapterEURC, 6));
    console.log("   USYC:", hre.ethers.formatUnits(adapterUSYC, 6));
    console.log();

    if (fundedCount > 0) {
        console.log("✅ Adapter funded successfully!");
        console.log();
        console.log("💡 Next Step:");
        console.log("   Migrate WizPay to use StableFXAdapter:");
        console.log("   node scripts/migrate-to-stablefx.js");
    } else {
        console.log("⚠️  No tokens were funded. Get testnet tokens first:");
        console.log("   1. Visit https://faucet.circle.com/");
        console.log("   2. Request USDC, EURC, and USYC for ARC Testnet");
        console.log("   3. Run this script again");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Funding failed:");
        console.error(error);
        process.exit(1);
    });
