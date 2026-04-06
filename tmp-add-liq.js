import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);
    
    const ADAPTER_ADDRESS = process.env.STABLEFX_ADAPTER_ADDRESS;
    const EURC_ADDRESS = process.env.ARC_EURC;
    const USDC_ADDRESS = process.env.ARC_USDC;
    
    const adapterABI = [
        "function addLiquidity(address token, uint256 amount) external",
        "function getLiquidity(address token) external view returns (uint256)"
    ];
    const erc20ABI = [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)"
    ];
    
    const adapter = new hre.ethers.Contract(ADAPTER_ADDRESS, adapterABI, deployer);
    const eurc = new hre.ethers.Contract(EURC_ADDRESS, erc20ABI, deployer);
    
    let eurcBal = await eurc.balanceOf(deployer.address);
    console.log("EURC Balance:", hre.ethers.formatUnits(eurcBal, 18)); // Ah wait, EURC usually has 6 or 18. The adapter script says default to 6. Let's just print.
    console.log("EURC Balance (wei):", eurcBal.toString());
    
    const toAdd = hre.ethers.parseUnits("10", 6); // Add 10 EURC
    if (eurcBal >= toAdd) {
        console.log("Approving...");
        const tx1 = await eurc.approve(ADAPTER_ADDRESS, toAdd);
        await tx1.wait();
        console.log("Adding liquidity...");
        const tx2 = await adapter.addLiquidity(EURC_ADDRESS, toAdd);
        await tx2.wait();
        console.log("Success add EURC!");
    } else {
        console.log("Not enough EURC, trying 1 EURC");
        const toAddSmall = hre.ethers.parseUnits("1", 6);
        if (eurcBal >= toAddSmall) {
             await eurc.approve(ADAPTER_ADDRESS, toAddSmall);
             await adapter.addLiquidity(EURC_ADDRESS, toAddSmall);
             console.log("Success add 1 EURC!");
        }
    }
}

main().catch(console.error);
