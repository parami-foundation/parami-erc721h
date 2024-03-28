import { ethers } from "hardhat";
import { GPTMinerInscription } from "../../typechain";

async function deployGPTMinerInscriptionForTest(): Promise<GPTMinerInscription> {
  const contractFactory = await ethers.getContractFactory("GPTMinerInscription");
  const instance = await contractFactory.deploy();
  await instance.deployed();

  console.log("GPTMinerInscription contract deployed to", instance.address);

  return instance;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployGPTMinerInscriptionForTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
