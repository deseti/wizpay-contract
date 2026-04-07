import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("WizPay", function () {
  let wizPay;
  let fxEngine;
  let mockEURC;
  let mockUSDC;
  let owner;
  let sender;
  let recipientA;
  let recipientB;
  let feeCollector;

  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 6);
  const EURC_TO_USDC_RATE = ethers.parseEther("1.1");
  const USDC_TO_EURC_RATE = ethers.parseEther("0.909090909090909090");
  const FEE_BPS = 10;

  beforeEach(async function () {
    [owner, sender, recipientA, recipientB, feeCollector] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockEURC = await MockERC20.deploy("Mock Euro Coin", "EURC", 6, INITIAL_SUPPLY);
    mockUSDC = await MockERC20.deploy("Mock USD Coin", "USDC", 6, INITIAL_SUPPLY);

    const MockFXEngine = await ethers.getContractFactory("MockFXEngine");
    fxEngine = await MockFXEngine.deploy();

    await fxEngine.setExchangeRate(
      await mockEURC.getAddress(),
      await mockUSDC.getAddress(),
      EURC_TO_USDC_RATE
    );
    await fxEngine.setExchangeRate(
      await mockUSDC.getAddress(),
      await mockEURC.getAddress(),
      USDC_TO_EURC_RATE
    );

    await mockUSDC.transfer(await fxEngine.getAddress(), ethers.parseUnits("500000", 6));
    await mockEURC.transfer(await fxEngine.getAddress(), ethers.parseUnits("500000", 6));

    const WizPay = await ethers.getContractFactory("WizPay");
    wizPay = await WizPay.deploy(
      await fxEngine.getAddress(),
      feeCollector.address,
      FEE_BPS
    );

    await mockEURC.transfer(sender.address, ethers.parseUnits("10000", 6));
    await mockUSDC.transfer(sender.address, ethers.parseUnits("10000", 6));
  });

  it("returns fee-aware estimates for same-token routes", async function () {
    const amountIn = ethers.parseUnits("100", 6);
    const expectedFee = (amountIn * BigInt(FEE_BPS)) / 10000n;
    const expectedNet = amountIn - expectedFee;

    const estimate = await wizPay.getEstimatedOutput(
      await mockUSDC.getAddress(),
      await mockUSDC.getAddress(),
      amountIn
    );

    expect(estimate).to.equal(expectedNet);
  });

  it("supports mixed batch routing with direct transfer and swap recipients", async function () {
    const inputToken = await mockUSDC.getAddress();
    const outputTokens = [inputToken, await mockEURC.getAddress()];
    const recipients = [recipientA.address, recipientB.address];
    const amountsIn = [
      ethers.parseUnits("100", 6),
      ethers.parseUnits("50", 6),
    ];

    await mockUSDC.connect(sender).approve(
      await wizPay.getAddress(),
      amountsIn[0] + amountsIn[1]
    );

    const [estimates, totalEstimatedOut, totalFees] =
      await wizPay.getBatchEstimatedOutputs(inputToken, outputTokens, amountsIn);

    expect(estimates).to.have.lengthOf(2);
    expect(totalEstimatedOut).to.equal(estimates[0] + estimates[1]);
    expect(totalFees).to.equal(
      (amountsIn[0] * BigInt(FEE_BPS)) / 10000n +
        (amountsIn[1] * BigInt(FEE_BPS)) / 10000n
    );

    const minAmountsOut = estimates.map((estimate) => (estimate * 98n) / 100n);

    await expect(
      wizPay
        .connect(sender)
        ["batchRouteAndPay(address,address[],address[],uint256[],uint256[],string)"](
          inputToken,
          outputTokens,
          recipients,
          amountsIn,
          minAmountsOut,
          "APR-2026-MIXED"
        )
    )
      .to.emit(wizPay, "BatchPaymentRouted")
      .withArgs(
        sender.address,
        inputToken,
        ethers.ZeroAddress,
        amountsIn[0] + amountsIn[1],
        totalEstimatedOut,
        totalFees,
        BigInt(recipients.length),
        "APR-2026-MIXED"
      );

    expect(await mockUSDC.balanceOf(recipientA.address)).to.equal(estimates[0]);
    expect(await mockEURC.balanceOf(recipientB.address)).to.equal(estimates[1]);
  });

  it("keeps legacy single-token batch routing compatible", async function () {
    const tokenIn = await mockEURC.getAddress();
    const tokenOut = await mockUSDC.getAddress();
    const recipients = [recipientA.address, recipientB.address];
    const amountsIn = [
      ethers.parseUnits("10", 6),
      ethers.parseUnits("15", 6),
    ];
    const minAmountsOut = [
      ethers.parseUnits("10", 6),
      ethers.parseUnits("15", 6),
    ];

    await mockEURC.connect(sender).approve(
      await wizPay.getAddress(),
      amountsIn[0] + amountsIn[1]
    );

    await expect(
      wizPay
        .connect(sender)
        ["batchRouteAndPay(address,address,address[],uint256[],uint256[],string)"](
          tokenIn,
          tokenOut,
          recipients,
          amountsIn,
          minAmountsOut,
          "APR-2026-LEGACY"
        )
    ).to.emit(wizPay, "BatchPaymentRouted");
  });
});
