import { ethers } from "hardhat";
import { AIMeFactory } from "../../typechain";

async function deployAIMeForTest(): Promise<AIMeFactory> {
  const contractFactory = await ethers.getContractFactory("AIMeFactory");
  const instance = await contractFactory.deploy();
  await instance.deployed();

  console.log("AIMeFactory V0 contract deployed to", instance.address);

  return instance;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployAIMeForTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
