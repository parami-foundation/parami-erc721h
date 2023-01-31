// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import { AD3 } from "../../typechain";

async function deployAd3ForTest(adminAddress: string): Promise<AD3> {
  const contractFactory = await ethers.getContractFactory("AD3");
  const instance = await contractFactory.deploy(
    1n * 10n ** 8n * 10n ** 18n,
    "AD3",
    "AD3",
    adminAddress,
    adminAddress,
    0,
    adminAddress
  );
  await instance.deployed();

  console.log("AD3 deployed to", instance.address);

  return instance;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployAd3ForTest("0x9F883b12fD0692714C2f28be6C40d3aFdb9081D3").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export { deployAd3ForTest as deployAd3 };
