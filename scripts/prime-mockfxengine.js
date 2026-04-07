import hre from "hardhat";

const { ethers } = hre;

const ARC_CONTRACTS = {
  mockFxEngine: "0xCbaf97B317A9cAAAE27c3d8deD48d845C4064C32",
  USDC: "0x3600000000000000000000000000000000000000",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
};

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const usdcLiquidity = ethers.parseUnits(
    process.env.SEED_USDC_LIQUIDITY || "10",
    6
  );
  const eurcLiquidity = ethers.parseUnits(
    process.env.SEED_EURC_LIQUIDITY || "10",
    6
  );

  const fxEngine = await ethers.getContractAt(
    "MockFXEngine",
    ARC_CONTRACTS.mockFxEngine
  );
  const usdc = new ethers.Contract(ARC_CONTRACTS.USDC, ERC20_ABI, deployer);
  const eurc = new ethers.Contract(ARC_CONTRACTS.EURC, ERC20_ABI, deployer);

  console.log("Priming MockFXEngine from:", deployer.address);
  console.log("MockFXEngine:", ARC_CONTRACTS.mockFxEngine);

  await (await fxEngine.setExchangeRate(
    ARC_CONTRACTS.EURC,
    ARC_CONTRACTS.USDC,
    ethers.parseEther("1.1")
  )).wait();

  await (await fxEngine.setExchangeRate(
    ARC_CONTRACTS.USDC,
    ARC_CONTRACTS.EURC,
    ethers.parseEther("0.909090909090909091")
  )).wait();

  if (usdcLiquidity > 0n) {
    await (await usdc.transfer(ARC_CONTRACTS.mockFxEngine, usdcLiquidity)).wait();
  }

  if (eurcLiquidity > 0n) {
    await (await eurc.transfer(ARC_CONTRACTS.mockFxEngine, eurcLiquidity)).wait();
  }

  const [engineUsdc, engineEurc] = await Promise.all([
    usdc.balanceOf(ARC_CONTRACTS.mockFxEngine),
    eurc.balanceOf(ARC_CONTRACTS.mockFxEngine),
  ]);

  console.log("Configured rates:");
  console.log("  EURC -> USDC = 1.1");
  console.log("  USDC -> EURC = 0.909090909090909091");
  console.log("Engine balances:");
  console.log("  USDC:", ethers.formatUnits(engineUsdc, 6));
  console.log("  EURC:", ethers.formatUnits(engineEurc, 6));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Prime failed:", error);
    process.exit(1);
  });
