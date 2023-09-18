import { ethers } from "hardhat";
import { AIMePowers } from "../../typechain";

async function deployAIMeForTest(): Promise<AIMePowers> {
  const contractFactory = await ethers.getContractFactory("AIMePowers");
  const instance = await contractFactory.deploy();
  await instance.deployed();

  console.log("AIMePowers deployed to", instance.address);

  return instance;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployAIMeForTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
