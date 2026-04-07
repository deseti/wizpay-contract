import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const WIZPAY_ADDRESS = "0x87ACE45582f45cC81AC1E627E875AE84cbd75946";
    const NEW_ADAPTER = "0xb94Ea89022592A4588b03300D79Ca90529514f61";

    const [deployer] = await hre.ethers.getSigners();
    console.log("Updating WizPay with account:", deployer.address);

    const wizpay = await hre.ethers.getContractAt("WizPay", WIZPAY_ADDRESS);
    
    console.log("Current fxEngine:", await wizpay.fxEngine());
    
    const tx = await wizpay.updateFXEngine(NEW_ADAPTER);
    console.log("Tx hash:", tx.hash);
    await tx.wait();
    console.log("WizPay fxEngine updated to:", await wizpay.fxEngine());
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
