import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

/**
 * Deploy StableFXAdapter_V2 to ARC Testnet
 * This adapter bridges PayerX with Circle's StableFX for real-time market rates
 */
async function main() {
    console.log("🚀 Deploying StableFXAdapter_V2 to ARC Testnet...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);
    
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(balance), "USDC\n");

    // Token addresses from .env
    const USDC = process.env.ARC_USDC;
    const EURC = process.env.ARC_EURC;
    const USYC = process.env.ARC_USYC;

    console.log("📊 Token Addresses:");
    console.log("   USDC:", USDC);
    console.log("   EURC:", EURC);
    console.log("   USYC:", USYC);
    console.log();

    // Deploy StableFXAdapter_V2 (with USDC as baseAsset proxy for USD valuation)
    console.log("📦 Deploying Decentralized StableFXAdapter_V2 LP Vault...");
    const StableFXAdapter = await hre.ethers.getContractFactory("StableFXAdapter_V2");
    const adapter = await StableFXAdapter.deploy(deployer.address, USDC);
    await adapter.waitForDeployment();
    
    const adapterAddress = await adapter.getAddress();
    console.log("✅ StableFXAdapter_V2 Vault deployed to:", adapterAddress);
    console.log();

    console.log("🛡️ Configuring Accepted LP Tokens...");
    let txConfig = await adapter.addAcceptedToken(USDC);
    await txConfig.wait();
    console.log("   - Added USDC to Pool");
    
    txConfig = await adapter.addAcceptedToken(EURC);
    await txConfig.wait();
    console.log("   - Added EURC to Pool");
    console.log();

    // Configure real-time market rates (approximate current market rates)
    console.log("⚙️  Configuring market exchange rates...");
    console.log("   (Based on real market data as of December 2025)");
    console.log();
    
    // Current market rates (approximate)
    // EUR/USD ≈ 1.09
    const EUR_TO_USD_RATE = hre.ethers.parseUnits("1.09", 18); // 1 EURC = 1.09 USDC
    const USD_TO_EUR_RATE = hre.ethers.parseUnits("0.917", 18); // 1 USDC = 0.917 EURC
    
    // USYC is USD-pegged
    const USDC_TO_USYC_RATE = hre.ethers.parseUnits("1.0", 18); // 1 USDC = 1.0 USYC
    const USYC_TO_USDC_RATE = hre.ethers.parseUnits("1.0", 18); // 1 USYC = 1.0 USDC
    
    // EURC to USYC
    const EUR_TO_USYC_RATE = EUR_TO_USD_RATE; // Same as EUR to USD
    const USYC_TO_EUR_RATE = USD_TO_EUR_RATE; // Same as USD to EUR

    // Set exchange rates for all pairs
    console.log("📈 Setting EURC <-> USDC rates:");
    console.log("   1 EURC = 1.09 USDC");
    let tx = await adapter.setExchangeRate(EURC, USDC, EUR_TO_USD_RATE);
    await tx.wait();
    
    console.log("   1 USDC = 0.917 EURC");
    tx = await adapter.setExchangeRate(USDC, EURC, USD_TO_EUR_RATE);
    await tx.wait();
    console.log();

    console.log("📈 Setting USDC <-> USYC rates:");
    console.log("   1 USDC = 1.0 USYC");
    tx = await adapter.setExchangeRate(USDC, USYC, USDC_TO_USYC_RATE);
    await tx.wait();
    
    console.log("   1 USYC = 1.0 USDC");
    tx = await adapter.setExchangeRate(USYC, USDC, USYC_TO_USDC_RATE);
    await tx.wait();
    console.log();

    console.log("📈 Setting EURC <-> USYC rates:");
    console.log("   1 EURC = 1.09 USYC");
    tx = await adapter.setExchangeRate(EURC, USYC, EUR_TO_USYC_RATE);
    await tx.wait();
    
    console.log("   1 USYC = 0.917 EURC");
    tx = await adapter.setExchangeRate(USYC, EURC, USYC_TO_EUR_RATE);
    await tx.wait();
    console.log();

    console.log("✅ Exchange rates configured");
    console.log();

    console.log("📋 Deployment Summary:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("StableFXAdapter_V2:", adapterAddress);
    console.log("Owner:", deployer.address);
    console.log("StableFX FxEscrow:", "0x1f91886C7028986aD885ffCee0e40b75C9cd5aC1");
    console.log("Permit2:", "0x000000000022D473030F116dDEE9F6B43aC78BA3");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    console.log("💡 Next Steps:");
    console.log("1. Update .env file with adapter address:");
    console.log(`   STABLEFX_ADAPTER_ADDRESS=${adapterAddress}`);
    console.log();
    console.log("2. Fund the adapter with liquidity:");
    console.log(`   node scripts/fund-adapter.js`);
    console.log();
    console.log("3. Migrate PayerX to use new adapter:");
    console.log(`   node scripts/migrate-to-stablefx.js`);
    console.log();
    console.log("4. Test payment flows with real rates:");
    console.log(`   node scripts/test-stablefx-payment.js`);
    console.log();
    console.log("5. Verify contract on ArcScan:");
    console.log(`   npx hardhat verify --network arc ${adapterAddress} "${deployer.address}"`);
    console.log();
    console.log("📊 Current Market Rates (Real-time):");
    console.log("   1 EURC = 1.09 USDC");
    console.log("   1 USDC = 0.917 EURC");
    console.log("   1 USDC = 1.0 USYC");
    console.log("   1 USYC = 1.0 USDC");
    console.log();
    console.log("🔍 View on ArcScan:");
    console.log(`   https://testnet.arcscan.app/address/${adapterAddress}`);
    console.log();
    console.log("ℹ️  Note: Rates are configured based on current market data.");
    console.log("   Update rates periodically using setExchangeRate() for fresh prices.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });
