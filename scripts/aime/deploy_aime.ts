import { ethers } from "hardhat";
import { AIMePowersV4 } from "../../typechain";

async function deployAIMeForTest(): Promise<AIMePowersV4> {
  const contractFactory = await ethers.getContractFactory("AIMePowersV4");
  const instance = await contractFactory.deploy();
  await instance.deployed();

  console.log("AIMe V4 contract deployed to", instance.address);

  return instance;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployAIMeForTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
