
import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();
async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const wizpay = await hre.ethers.getContractAt("WizPay", "0x87ACE45582f45cC81AC1E627E875AE84cbd75946");
    const tx = await wizpay.updateFXEngine("0x70Ed968B83F32ab7cA17e5dCB82db970FE8a0bD0");
    await tx.wait();
    console.log("WizPay fxEngine updated to:", await wizpay.fxEngine());
}
main().catch(e => { console.error(e); process.exit(1); });
