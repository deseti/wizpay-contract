import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Oracle Bot Started. Owner:", deployer.address);
    
    const ADAPTER_ADDRESS = process.env.STABLEFX_ADAPTER_ADDRESS;
    const USDC_ADDRESS = process.env.ARC_USDC;
    const EURC_ADDRESS = process.env.ARC_EURC;
    
    const adapterABI = ["function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external"];
    const adapter = new hre.ethers.Contract(ADAPTER_ADDRESS, adapterABI, deployer);
    
    // Set fixed standard rates (1 EUR = 1.09 USD)
    const eurcToUsdcRate = hre.ethers.parseUnits("1.0900", 18);
    const usdcToEurcRate = hre.ethers.parseUnits("0.9174", 18);
    
    async function updateRates() {
        try {
            console.log("\n[" + new Date().toISOString() + "] Updating rates...");
            let tx1 = await adapter.setExchangeRate(USDC_ADDRESS, EURC_ADDRESS, usdcToEurcRate);
            await tx1.wait();
            console.log("✅ USDC -> EURC updated");
            
            let tx2 = await adapter.setExchangeRate(EURC_ADDRESS, USDC_ADDRESS, eurcToUsdcRate);
            await tx2.wait();
            console.log("✅ EURC -> USDC updated");
        } catch (err) {
            console.error("Error updating rates:", err.message);
        }
    }
    
    // Update immediately, then every 4 minutes (Validity is 5 minutes)
    await updateRates();
    setInterval(updateRates, 4 * 60 * 1000);
    
    console.log("Keeping process alive to refresh rates every 4 minutes...");
    // Keep alive
    await new Promise(() => {});
}

main().catch(console.error);
