import { ethers } from "hardhat";
import { AIMeFactoryV2 } from "../../typechain";

async function deployAIMeForTest(): Promise<AIMeFactoryV2> {
  const contractFactory = await ethers.getContractFactory("AIMeFactoryV2");
  const instance = await contractFactory.deploy();
  await instance.deployed();

  console.log("AIMeFactory V2 contract deployed to", instance.address);

  return instance;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployAIMeForTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
