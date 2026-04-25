import hre from "hardhat";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("🚀 Starting One-Click Migration via Hardhat...");
    console.log("Account:", deployer.address);

    console.log("\n📦 Deploying StableFXAdapter (REAL)...");
    const StableFXAdapter = await hre.ethers.getContractFactory("StableFXAdapter");
    const adapter = await StableFXAdapter.deploy(deployer.address);
    await adapter.waitForDeployment();
    const adapterAddress = await adapter.getAddress();
    console.log("✅ Deployed Adapter to:", adapterAddress);

    const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
    const USDC = "0x3600000000000000000000000000000000000000";
    const USYC = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C";
    
    console.log("\n⚙️  Setting Market Rates...");
    const rate1 = hre.ethers.parseUnits("1.09", 18);
    const rate2 = hre.ethers.parseUnits("0.917", 18);
    const rate1to1 = hre.ethers.parseUnits("1.0", 18);

    await adapter.setExchangeRate(EURC, USDC, rate1).then(t => t.wait());
    await adapter.setExchangeRate(USDC, EURC, rate2).then(t => t.wait());
    await adapter.setExchangeRate(USDC, USYC, rate1to1).then(t => t.wait());
    await adapter.setExchangeRate(USYC, USDC, rate1to1).then(t => t.wait());
    console.log("✅ Exchange Rates Configured");

    console.log("\n💧 Funding Adapter...");
    const IERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)", "function transfer(address,uint256) returns (bool)"];
    const usdc = await hre.ethers.getContractAt(IERC20_ABI, USDC);
    const eurc = await hre.ethers.getContractAt(IERC20_ABI, EURC);
    
    // Fund safely, e.g. 5 tokens
    const fundAmount = hre.ethers.parseUnits("5", 6);
    
    const usdcBal = await usdc.balanceOf(deployer.address);
    if(usdcBal >= fundAmount) {
        await usdc.approve(adapterAddress, fundAmount).then(t => t.wait());
        await adapter.addLiquidity(USDC, fundAmount).then(t => t.wait());
        console.log("   ✓ USDC liquidity added");
    } else {
        console.log("   ⚠️ Not enough USDC to fund");
    }
    
    const eurcBal = await eurc.balanceOf(deployer.address);
    if(eurcBal >= fundAmount) {
        await eurc.approve(adapterAddress, fundAmount).then(t => t.wait());
        await adapter.addLiquidity(EURC, fundAmount).then(t => t.wait());
        console.log("   ✓ EURC liquidity added");
    } else {
        console.log("   ⚠️ Not enough EURC to fund");
    }

    console.log("\n🔄 Migrating WizPay Router...");
    const WIZPAY_ADDRESS = "0x6E8B94dE557D7EB5C0628722511F0A0236a57214";
    const wizpay = await hre.ethers.getContractAt("WizPay", WIZPAY_ADDRESS);
    
    const tx = await wizpay.updateFXEngine(adapterAddress);
    await tx.wait();
    console.log("✅ Successfully migrated WizPay to use real StableFXAdapter!");
}

main().catch(console.error);
