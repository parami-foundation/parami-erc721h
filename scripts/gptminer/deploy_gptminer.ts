import { ethers } from "hardhat";
import { GPTMiner } from "../../typechain";

async function deployAIMeForTest(): Promise<GPTMiner> {
  const contractFactory = await ethers.getContractFactory("GPTMiner");
  const instance = await contractFactory.deploy();
  await instance.deployed();

  console.log("GPTMiner contract deployed to", instance.address);

  return instance;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployAIMeForTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
