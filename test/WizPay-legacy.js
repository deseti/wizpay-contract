import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("WizPay Smart Payment Router", function () {
  let wizPay;
  let fxEngine;
  let mockEURC;
  let mockUSDC;
  let owner;
  let sender;
  let recipient;
  let feeCollector;

  // Test constants
  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 6); // 1M tokens with 6 decimals
  const EURC_TO_USDC_RATE = ethers.parseEther("1.1"); // 1 EURC = 1.1 USDC (18 decimals precision)
  const USDC_TO_EURC_RATE = ethers.parseEther("0.909090909090909090"); // 1 USDC = ~0.909 EURC
  const FEE_BPS = 10; // 0.1% fee

  beforeEach(async function () {
    // Get signers
    [owner, sender, recipient, feeCollector] = await ethers.getSigners();

    // Deploy mock stablecoins
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    mockEURC = await MockERC20.deploy("Mock Euro Coin", "EURC", 6, INITIAL_SUPPLY);
    await mockEURC.waitForDeployment();
    
    mockUSDC = await MockERC20.deploy("Mock USD Coin", "USDC", 6, INITIAL_SUPPLY);
    await mockUSDC.waitForDeployment();

    // Deploy mock FX Engine
    const MockFXEngine = await ethers.getContractFactory("MockFXEngine");
    fxEngine = await MockFXEngine.deploy();
    await fxEngine.waitForDeployment();

    // Set exchange rates
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

    // Fund FX Engine with liquidity
    await mockUSDC.transfer(await fxEngine.getAddress(), ethers.parseUnits("500000", 6));
    await mockEURC.transfer(await fxEngine.getAddress(), ethers.parseUnits("500000", 6));

    // Deploy WizPay
    const WizPay = await ethers.getContractFactory("WizPay");
    wizPay = await WizPay.deploy(await fxEngine.getAddress(), feeCollector.address, FEE_BPS);
    await wizPay.waitForDeployment();

    // Fund sender with EURC
    await mockEURC.transfer(sender.address, ethers.parseUnits("10000", 6));
  });

  describe("Deployment", function () {
    it("Should set the correct FX Engine address", async function () {
      expect(await wizPay.fxEngine()).to.equal(await fxEngine.getAddress());
    });

    it("Should set the correct owner", async function () {
      expect(await wizPay.owner()).to.equal(owner.address);
    });

    it("Should revert if FX Engine address is zero", async function () {
      const WizPay = await ethers.getContractFactory("WizPay");
      await expect(
        WizPay.deploy(ethers.ZeroAddress, feeCollector.address, FEE_BPS)
      ).to.be.revertedWith("WizPay: FX Engine cannot be zero address");
    });

    it("Should revert if fee exceeds maximum", async function () {
      const WizPay = await ethers.getContractFactory("WizPay");
      await expect(
        WizPay.deploy(await fxEngine.getAddress(), feeCollector.address, 150) // 1.5% > max
      ).to.be.revertedWith("WizPay: Fee exceeds maximum");
    });
  });

  describe("routeAndPay - Full Flow", function () {
    const PAYMENT_AMOUNT = ethers.parseUnits("1000", 6); // 1000 EURC
    const EXPECTED_OUTPUT = ethers.parseUnits("1100", 6); // 1100 USDC (1.1x rate)
    const MIN_AMOUNT_OUT = ethers.parseUnits("1090", 6); // Allow 1% slippage

    it("Should execute a complete payment flow from EURC to USDC", async function () {
      // Get initial balances
      const senderEURCBefore = await mockEURC.balanceOf(sender.address);
      const recipientUSDCBefore = await mockUSDC.balanceOf(recipient.address);
      const wizPayEURCBefore = await mockEURC.balanceOf(await wizPay.getAddress());

      // Step 1: Sender approves WizPay to spend EURC
      await mockEURC.connect(sender).approve(
        await wizPay.getAddress(),
        PAYMENT_AMOUNT
      );

      // Verify approval
      const allowance = await mockEURC.allowance(
        sender.address,
        await wizPay.getAddress()
      );
      expect(allowance).to.equal(PAYMENT_AMOUNT);

      // Step 2: Execute routeAndPay
      const tx = await wizPay.connect(sender).routeAndPay(
        await mockEURC.getAddress(),
        await mockUSDC.getAddress(),
        PAYMENT_AMOUNT,
        MIN_AMOUNT_OUT,
        recipient.address
      );

      // Wait for transaction and check for event
      const feeAmount = (PAYMENT_AMOUNT * BigInt(FEE_BPS)) / 10000n;
      const amountAfterFee = PAYMENT_AMOUNT - feeAmount;
      const expectedOutputAfterFee = (EXPECTED_OUTPUT * amountAfterFee) / PAYMENT_AMOUNT;
      
      await expect(tx)
        .to.emit(wizPay, "PaymentRouted")
        .withArgs(
          sender.address,
          recipient.address,
          await mockEURC.getAddress(),
          await mockUSDC.getAddress(),
          PAYMENT_AMOUNT,
          expectedOutputAfterFee,
          feeAmount
        );

      // Step 3: Verify final balances
      const senderEURCAfter = await mockEURC.balanceOf(sender.address);
      const recipientUSDCAfter = await mockUSDC.balanceOf(recipient.address);
      const wizPayEURCAfter = await mockEURC.balanceOf(await wizPay.getAddress());
      const feeCollectorBalance = await mockEURC.balanceOf(feeCollector.address);

      // Sender should have less EURC
      expect(senderEURCAfter).to.equal(senderEURCBefore - PAYMENT_AMOUNT);

      // Recipient should have received USDC (after fee deduction)
      expect(recipientUSDCAfter).to.equal(recipientUSDCBefore + expectedOutputAfterFee);

      // Fee collector should have received fee
      expect(feeCollectorBalance).to.equal(feeAmount);

      // WizPay contract should have no leftover EURC (non-custodial)
      expect(wizPayEURCAfter).to.equal(wizPayEURCBefore);
    });

    it("Should work for reverse swap (USDC to EURC)", async function () {
      // Fund sender with USDC instead
      await mockUSDC.transfer(sender.address, ethers.parseUnits("10000", 6));

      const paymentAmount = ethers.parseUnits("1000", 6); // 1000 USDC
      const expectedOutput = ethers.parseUnits("909", 6); // ~909 EURC
      const minAmountOut = ethers.parseUnits("900", 6);

      // Approve and execute
      await mockUSDC.connect(sender).approve(
        await wizPay.getAddress(),
        paymentAmount
      );

      await wizPay.connect(sender).routeAndPay(
        await mockUSDC.getAddress(),
        await mockEURC.getAddress(),
        paymentAmount,
        minAmountOut,
        recipient.address
      );

      // Verify recipient received EURC
      const recipientEURCBalance = await mockEURC.balanceOf(recipient.address);
      expect(recipientEURCBalance).to.be.gte(minAmountOut);
    });
  });

  describe("Slippage Protection", function () {
    const PAYMENT_AMOUNT = ethers.parseUnits("1000", 6);
    const EXPECTED_OUTPUT = ethers.parseUnits("1100", 6);
    const UNREALISTIC_MIN = ethers.parseUnits("2000", 6); // Demand 2000 USDC (impossible)

    it("Should revert if minAmountOut is not met", async function () {
      // Approve WizPay
      await mockEURC.connect(sender).approve(
        await wizPay.getAddress(),
        PAYMENT_AMOUNT
      );

      // Try to execute with unrealistic slippage protection
      await expect(
        wizPay.connect(sender).routeAndPay(
          await mockEURC.getAddress(),
          await mockUSDC.getAddress(),
          PAYMENT_AMOUNT,
          UNREALISTIC_MIN,
          recipient.address
        )
      ).to.be.revertedWith("MockFXEngine: slippage tolerance exceeded");
    });

    it("Should revert when FX Engine simulates bad slippage", async function () {
      // Enable slippage failure mode in mock FX Engine
      await fxEngine.setSlippageFailure(true);

      const minAmountOut = ethers.parseUnits("1000", 6); // Reasonable expectation

      // Approve WizPay
      await mockEURC.connect(sender).approve(
        await wizPay.getAddress(),
        PAYMENT_AMOUNT
      );

      // Should fail because FX Engine will return only half the expected amount
      await expect(
        wizPay.connect(sender).routeAndPay(
          await mockEURC.getAddress(),
          await mockUSDC.getAddress(),
          PAYMENT_AMOUNT,
          minAmountOut,
          recipient.address
        )
      ).to.be.revertedWith("MockFXEngine: slippage tolerance exceeded");

      // Disable slippage failure for subsequent tests
      await fxEngine.setSlippageFailure(false);
    });

    it("Should succeed with realistic slippage tolerance", async function () {
      const minAmountOut = ethers.parseUnits("1050", 6); // 5% tolerance

      await mockEURC.connect(sender).approve(
        await wizPay.getAddress(),
        PAYMENT_AMOUNT
      );

      const tx = await wizPay.connect(sender).routeAndPay(
        await mockEURC.getAddress(),
        await mockUSDC.getAddress(),
        PAYMENT_AMOUNT,
        minAmountOut,
        recipient.address
      );

      await expect(tx).to.emit(wizPay, "PaymentRouted");
    });
  });

  describe("Input Validation", function () {
    const PAYMENT_AMOUNT = ethers.parseUnits("1000", 6);
    const MIN_AMOUNT_OUT = ethers.parseUnits("1000", 6);

    it("Should revert if tokenIn is zero address", async function () {
      await expect(
        wizPay.connect(sender).routeAndPay(
          ethers.ZeroAddress,
          await mockUSDC.getAddress(),
          PAYMENT_AMOUNT,
          MIN_AMOUNT_OUT,
          recipient.address
        )
      ).to.be.revertedWith("WizPay: tokenIn cannot be zero address");
    });

    it("Should revert if tokenOut is zero address", async function () {
      await expect(
        wizPay.connect(sender).routeAndPay(
          await mockEURC.getAddress(),
          ethers.ZeroAddress,
          PAYMENT_AMOUNT,
          MIN_AMOUNT_OUT,
          recipient.address
        )
      ).to.be.revertedWith("WizPay: tokenOut cannot be zero address");
    });

    it("Should revert if amountIn is zero", async function () {
      await expect(
        wizPay.connect(sender).routeAndPay(
          await mockEURC.getAddress(),
          await mockUSDC.getAddress(),
          0,
          MIN_AMOUNT_OUT,
          recipient.address
        )
      ).to.be.revertedWith("WizPay: amountIn must be greater than zero");
    });

    it("Should revert if recipient is zero address", async function () {
      await mockEURC.connect(sender).approve(
        await wizPay.getAddress(),
        PAYMENT_AMOUNT
      );

      await expect(
        wizPay.connect(sender).routeAndPay(
          await mockEURC.getAddress(),
          await mockUSDC.getAddress(),
          PAYMENT_AMOUNT,
          MIN_AMOUNT_OUT,
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("WizPay: recipient cannot be zero address");
    });

    it("Should revert if sender has insufficient balance", async function () {
      const hugeAmount = ethers.parseUnits("1000000", 6);

      await mockEURC.connect(sender).approve(
        await wizPay.getAddress(),
        hugeAmount
      );

      await expect(
        wizPay.connect(sender).routeAndPay(
          await mockEURC.getAddress(),
          await mockUSDC.getAddress(),
          hugeAmount,
          MIN_AMOUNT_OUT,
          recipient.address
        )
      ).to.be.revertedWith("MockERC20: insufficient balance");
    });

    it("Should revert if approval is insufficient", async function () {
      // Approve only half of what we need
      await mockEURC.connect(sender).approve(
        await wizPay.getAddress(),
        PAYMENT_AMOUNT / 2n
      );

      await expect(
        wizPay.connect(sender).routeAndPay(
          await mockEURC.getAddress(),
          await mockUSDC.getAddress(),
          PAYMENT_AMOUNT,
          MIN_AMOUNT_OUT,
          recipient.address
        )
      ).to.be.revertedWith("MockERC20: insufficient allowance");
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to update FX Engine", async function () {
      const newFXEngine = await (await ethers.getContractFactory("MockFXEngine")).deploy();
      await newFXEngine.waitForDeployment();

      const tx = await wizPay.updateFXEngine(await newFXEngine.getAddress());

      await expect(tx)
        .to.emit(wizPay, "FXEngineUpdated")
        .withArgs(await fxEngine.getAddress(), await newFXEngine.getAddress());

      expect(await wizPay.fxEngine()).to.equal(await newFXEngine.getAddress());
    });

    it("Should prevent non-owner from updating FX Engine", async function () {
      const newFXEngine = await (await ethers.getContractFactory("MockFXEngine")).deploy();
      await newFXEngine.waitForDeployment();

      await expect(
        wizPay.connect(sender).updateFXEngine(await newFXEngine.getAddress())
      ).to.be.revertedWithCustomError(wizPay, "OwnableUnauthorizedAccount");
    });

    it("Should revert if new FX Engine is zero address", async function () {
      await expect(
        wizPay.updateFXEngine(ethers.ZeroAddress)
      ).to.be.revertedWith("WizPay: FX Engine cannot be zero address");
    });
  });

  describe("getEstimatedOutput", function () {
    it("Should return correct estimated output amount", async function () {
      const amountIn = ethers.parseUnits("1000", 6);
      const expectedOut = ethers.parseUnits("1100", 6);

      const estimate = await wizPay.getEstimatedOutput(
        await mockEURC.getAddress(),
        await mockUSDC.getAddress(),
        amountIn
      );

      expect(estimate).to.equal(expectedOut);
    });

    it("Should return zero for unset exchange rates", async function () {
      const randomToken = await (await ethers.getContractFactory("MockERC20"))
        .deploy("Random", "RND", 6, INITIAL_SUPPLY);

      const estimate = await wizPay.getEstimatedOutput(
        await randomToken.getAddress(),
        await mockUSDC.getAddress(),
        ethers.parseUnits("1000", 6)
      );

      expect(estimate).to.equal(0);
    });
  });

  describe("Non-Custodial Nature", function () {
    it("Should never hold tokens after transaction", async function () {
      const paymentAmount = ethers.parseUnits("1000", 6);
      const minAmountOut = ethers.parseUnits("1000", 6);

      await mockEURC.connect(sender).approve(
        await wizPay.getAddress(),
        paymentAmount
      );

      await wizPay.connect(sender).routeAndPay(
        await mockEURC.getAddress(),
        await mockUSDC.getAddress(),
        paymentAmount,
        minAmountOut,
        recipient.address
      );

      // WizPay should have no EURC or USDC balance
      expect(await mockEURC.balanceOf(await wizPay.getAddress())).to.equal(0);
      expect(await mockUSDC.balanceOf(await wizPay.getAddress())).to.equal(0);
    });

    it("Should handle multiple consecutive payments without accumulating funds", async function () {
      const paymentAmount = ethers.parseUnits("100", 6);
      const minAmountOut = ethers.parseUnits("100", 6);

      for (let i = 0; i < 5; i++) {
        await mockEURC.connect(sender).approve(
          await wizPay.getAddress(),
          paymentAmount
        );

        await wizPay.connect(sender).routeAndPay(
          await mockEURC.getAddress(),
          await mockUSDC.getAddress(),
          paymentAmount,
          minAmountOut,
          recipient.address
        );

        // Verify no accumulation
        expect(await mockEURC.balanceOf(await wizPay.getAddress())).to.equal(0);
        expect(await mockUSDC.balanceOf(await wizPay.getAddress())).to.equal(0);
      }
    });
  });

  describe("Atomicity", function () {
    it("Should revert entire transaction if swap fails", async function () {
      const paymentAmount = ethers.parseUnits("1000", 6);
      
      // Get initial balance
      const initialBalance = await mockEURC.balanceOf(sender.address);

      // Set impossible minAmountOut to force swap failure
      await mockEURC.connect(sender).approve(
        await wizPay.getAddress(),
        paymentAmount
      );

      await expect(
        wizPay.connect(sender).routeAndPay(
          await mockEURC.getAddress(),
          await mockUSDC.getAddress(),
          paymentAmount,
          ethers.parseUnits("10000", 6), // Impossible amount
          recipient.address
        )
      ).to.be.reverted;

      // Sender balance should be unchanged (atomic revert)
      expect(await mockEURC.balanceOf(sender.address)).to.equal(initialBalance);
    });
  });
});
