import { ethers } from "hardhat";
import { GPTMinerV2 } from "../../typechain";

async function deployAIMeForTest(): Promise<GPTMinerV2> {
  const contractFactory = await ethers.getContractFactory("GPTMinerV2");
  const instance = await contractFactory.deploy();
  await instance.deployed();

  console.log("GPTMinerV2 contract deployed to", instance.address);

  return instance;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployAIMeForTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
