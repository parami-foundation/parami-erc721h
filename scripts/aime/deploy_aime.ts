import { ethers } from "hardhat";
import { AIMePowersV5 } from "../../typechain";

async function deployAIMeForTest(): Promise<AIMePowersV5> {
  const contractFactory = await ethers.getContractFactory("AIMePowersV5");
  const instance = await contractFactory.deploy();
  await instance.deployed();

  console.log("AIMe V5 contract deployed to", instance.address);

  return instance;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployAIMeForTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
