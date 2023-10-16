import { ethers } from "hardhat";
import { AIMeAMA } from "../../typechain";

async function deployAIMeForTest(): Promise<AIMeAMA> {
  const contractFactory = await ethers.getContractFactory("AIMeAMA");
  const instance = await contractFactory.deploy();
  await instance.deployed();

  console.log("AIMe AMA contract deployed to", instance.address);

  return instance;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployAIMeForTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
