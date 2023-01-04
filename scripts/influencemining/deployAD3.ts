// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";

async function main() {
    const contractFactory = await ethers.getContractFactory("AD3");
    const instance = await contractFactory.deploy(1n * 10n ** 8n, "AD3", "AD3", "0x884FabC1D7C8d43A9639672690eD20F5f4cC16e1", "0x884FabC1D7C8d43A9639672690eD20F5f4cC16e1", 86400, "0x884FabC1D7C8d43A9639672690eD20F5f4cC16e1");
    await instance.deployed();

    console.log("AD3 deployed to", instance.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
