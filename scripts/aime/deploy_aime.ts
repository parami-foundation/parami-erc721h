import { ethers } from "hardhat";
import { AIMe } from "../../typechain";

async function deployAIMeForTest(): Promise<AIMe> {
  const contractFactory = await ethers.getContractFactory("AIMe");
  const instance = await contractFactory.deploy();
  await instance.deployed();

  console.log("AIMe deployed to", instance.address);

  return instance;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployAIMeForTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
