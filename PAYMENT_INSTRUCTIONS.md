# WizPay - Flexible Payment Script

**Send any amount of EURC → USDC on Arc Testnet with real market rates**

## Quick Start

### PowerShell (Windows)

```powershell
$env:AMOUNT="0.1"; $env:RECIPIENT="0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484"; npx hardhat run scripts/payment.js --network arc-testnet
```

### Linux / Mac / Git Bash

```bash
AMOUNT=0.1 RECIPIENT=0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484 npx hardhat run scripts/payment.js --network arc-testnet
```

## Parameters

| Variable  | Description | Example |
|-----------|-------------|---------|
| `AMOUNT` | Amount of EURC to send | `0.1`, `0.05`, `0.01` |
| `RECIPIENT` | Recipient wallet address | `0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484` |

## What It Does

1. **Checks balance** - Verifies you have sufficient EURC
2. **Fetches real rate** - Gets live EUR/USD from official API (1 EUR = 1.16 USD)
3. **Updates adapter** - Sets exchange rate on contract
4. **Approves tokens** - Grants WizPay permission to spend EURC
5. **Executes payment** - Routes EURC → USDC to recipient
6. **Shows transaction** - Links to ARC Explorer for verification

## Examples

### Send 0.1 EURC (PowerShell)
```powershell
$env:AMOUNT="0.1"; $env:RECIPIENT="0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484"; npx hardhat run scripts/payment.js --network arc-testnet
```

### Send 0.05 EURC to different recipient (PowerShell)
```powershell
$env:AMOUNT="0.05"; $env:RECIPIENT="0x1234567890123456789012345678901234567890"; npx hardhat run scripts/payment.js --network arc-testnet
```

### Send 0.01 EURC (Linux/Mac)
```bash
AMOUNT=0.01 RECIPIENT=0xef6582d8bd8c5e6f1ca37181b4b6284c945b3484 npx hardhat run scripts/payment.js --network arc-testnet
```

## Testnet Liquidity Limits

⚠️ **Current Observation**: The adapter has limited USDC. Transactions that worked:
- ✅ 0.1 EURC - succeeded
- ❌ 0.15+ EURC - failed (insufficient adapter liquidity)

**Solution**: Use smaller amounts or wait for adapter to be refunded with more USDC.

## Real Transactions (Verified)

All payments execute on **real Arc Testnet** (Chain ID 5042002):
- Explorer: https://testnet.arcscan.app
- Example: https://testnet.arcscan.app/tx/0x2263e3ea0690c9ed239e2bb0f1597a675b3c3ef962fd951f4920ca89c6dfd920

## Key Features

✅ **No hardcoding** - Any amount, any recipient
✅ **Real market data** - Official EUR/USD rates from Exchangerate-API
✅ **Real blockchain** - All transactions on actual Arc Testnet
✅ **Non-custodial** - Tokens flow directly, no intermediary
✅ **Verifiable** - See transactions in Arc Explorer

## Architecture

```
User sends EURC → WizPay Contract → Adapter (converts via rate) → USDC → Recipient
```

All token flows are direct and non-custodial.

## Troubleshooting

### "Insufficient liquidity" error
**Cause**: Adapter USDC balance is low
**Fix**: Try a smaller amount (≤ 0.1 EURC)

### "Insufficient EURC balance"
**Cause**: Account doesn't have enough EURC  
**Fix**: Request testnet EURC from Circle Faucet: https://faucet.circle.com/

### Transaction still fails
1. Check adapter liquidity: https://testnet.arcscan.app/address/0x177030FBa1dE345F99C91ccCf4Db615E8016f75D
2. Try smaller amount
3. Wait and retry (rate may need updating)

## Files

- `scripts/payment.js` - Main payment script
- `contracts/WizPay.sol` - Non-custodial router
- `hardhat.config.js` - Network config

## Network

| Property | Value |
|----------|-------|
| Chain | Arc Testnet |
| Chain ID | 5042002 |
| RPC | https://rpc.testnet.arc.network |
| Explorer | https://testnet.arcscan.app |

---

**Status**: ✅ Ready for production use (testnet liquidity constraints noted)
