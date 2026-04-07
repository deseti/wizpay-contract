import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    console.log("🌊 Seeding StableFXAdapter with 50% of Wallet Balance...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Account:", deployer.address);
    
    // Hardcoded from our recent deployment response
    const STABLEFX_ADAPTER_ADDRESS = "0x70Ed968B83F32ab7cA17e5dCB82db970FE8a0bD0";
    const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
    const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

    const usdc = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDC_ADDRESS);
    const eurc = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", EURC_ADDRESS);
    
    // We can use the compiled ABI from compiling StableFXAdapter
    const adapter = await hre.ethers.getContractAt("StableFXAdapter", STABLEFX_ADAPTER_ADDRESS);

    // Get balances
    const usdcBal = await usdc.balanceOf(deployer.address);
    const eurcBal = await eurc.balanceOf(deployer.address);

    const usdcSip = usdcBal / 2n;
    const eurcSip = eurcBal / 2n;

    console.log("USDC Balance:", hre.ethers.formatUnits(usdcBal, 6), "-> Seeding:", hre.ethers.formatUnits(usdcSip, 6));
    console.log("EURC Balance:", hre.ethers.formatUnits(eurcBal, 6), "-> Seeding:", hre.ethers.formatUnits(eurcSip, 6));

    const EUR_TO_USD_RATE = hre.ethers.parseUnits("1.09", 18);
    const USD_TO_EUR_RATE = hre.ethers.parseUnits("0.917", 18);
    
    console.log("\n0. Refreshing Exchange Rates (Oracle)...");
    let txR1 = await adapter.setExchangeRate(EURC_ADDRESS, USDC_ADDRESS, EUR_TO_USD_RATE);
    await txR1.wait();
    let txR2 = await adapter.setExchangeRate(USDC_ADDRESS, EURC_ADDRESS, USD_TO_EUR_RATE);
    await txR2.wait();
    console.log("✅ Exchange rates refreshed.");

    if (usdcSip > 0n) {
        console.log("\n1. Approving USDC...");
        const txA1 = await usdc.approve(STABLEFX_ADAPTER_ADDRESS, usdcSip);
        await txA1.wait();
        console.log("2. Adding USDC Liquidity...");
        const txL1 = await adapter.addLiquidity(USDC_ADDRESS, usdcSip);
        await txL1.wait();
        console.log("✅ USDC liquidity added!");
    }

    if (eurcSip > 0n) {
        console.log("\n1. Approving EURC...");
        const txA2 = await eurc.approve(STABLEFX_ADAPTER_ADDRESS, eurcSip);
        await txA2.wait();
        console.log("2. Adding EURC Liquidity...");
        const txL2 = await adapter.addLiquidity(EURC_ADDRESS, eurcSip);
        await txL2.wait();
        console.log("✅ EURC liquidity added!");
    }

    console.log("\n🎉 Seeding Complete! View in the Dashboard now!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Failed to seed:", error);
        process.exit(1);
    });
