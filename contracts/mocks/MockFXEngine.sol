// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../IERC20.sol";
import "../IFXEngine.sol";

/**
 * @title MockFXEngine
 * @dev Mock Foreign Exchange Engine for testing PayerX
 * Simulates the ARC native FX Engine with configurable exchange rates
 */
contract MockFXEngine is IFXEngine {
    // Exchange rate mapping: tokenIn => tokenOut => rate (with 18 decimals precision)
    // e.g., rate of 1.1e18 means 1 tokenIn = 1.1 tokenOut
    mapping(address => mapping(address => uint256)) public exchangeRates;

    // Whether to simulate slippage failure
    bool public shouldFailSlippage;

    event ExchangeRateSet(address indexed tokenIn, address indexed tokenOut, uint256 rate);
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed to
    );

    /**
     * @dev Set exchange rate between two tokens
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param rate Exchange rate with 18 decimals (1e18 = 1:1 rate)
     */
    function setExchangeRate(
        address tokenIn,
        address tokenOut,
        uint256 rate
    ) external {
        exchangeRates[tokenIn][tokenOut] = rate;
        emit ExchangeRateSet(tokenIn, tokenOut, rate);
    }

    /**
     * @dev Toggle slippage failure simulation
     */
    function setSlippageFailure(bool shouldFail) external {
        shouldFailSlippage = shouldFail;
    }

    /**
     * @dev Executes a mock swap
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address to
    ) external override returns (uint256 amountOut) {
        require(tokenIn != address(0), "MockFXEngine: tokenIn cannot be zero");
        require(tokenOut != address(0), "MockFXEngine: tokenOut cannot be zero");
        require(amountIn > 0, "MockFXEngine: amountIn must be greater than zero");
        require(to != address(0), "MockFXEngine: recipient cannot be zero");

        if (tokenIn == tokenOut) {
            require(amountIn >= minAmountOut, "MockFXEngine: slippage tolerance exceeded");

            bool directSuccess = IERC20(tokenIn).transferFrom(msg.sender, to, amountIn);
            require(directSuccess, "MockFXEngine: transferFrom failed");

            emit SwapExecuted(tokenIn, tokenOut, amountIn, amountIn, to);
            return amountIn;
        }

        // Calculate output amount based on exchange rate
        uint256 rate = exchangeRates[tokenIn][tokenOut];
        require(rate > 0, "MockFXEngine: exchange rate not set");

        amountOut = (amountIn * rate) / 1e18;

        // Simulate slippage failure if enabled
        if (shouldFailSlippage) {
            amountOut = amountOut / 2; // Cut output in half to simulate bad slippage
        }

        // Enforce slippage protection
        require(amountOut >= minAmountOut, "MockFXEngine: slippage tolerance exceeded");

        uint256 availableLiquidity = IERC20(tokenOut).balanceOf(address(this));
        require(availableLiquidity >= amountOut, "MockFXEngine: insufficient liquidity");

        // Pull input tokens from caller
        bool success = IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        require(success, "MockFXEngine: transferFrom failed");

        // Send output tokens to recipient
        success = IERC20(tokenOut).transfer(to, amountOut);
        require(success, "MockFXEngine: transfer failed");

        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, to);
        return amountOut;
    }

    /**
     * @dev Get estimated output amount
     */
    function getEstimatedAmount(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view override returns (uint256 estimatedAmountOut) {
        if (tokenIn == tokenOut) {
            return amountIn;
        }

        uint256 rate = exchangeRates[tokenIn][tokenOut];
        if (rate == 0) return 0;
        return (amountIn * rate) / 1e18;
    }
}
