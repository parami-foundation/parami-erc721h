import { ethers } from "hardhat";
import { AIMe404Power } from "../../typechain";

async function deployMockNFTForTest(): Promise<AIMe404Power> {
  // const contractFactory = await ethers.getContractFactory("MockNFT");
  // const instance = await contractFactory.deploy();
  // await instance.deployed();

  // console.log("MockNFT deployed to", instance.address);

  const contractFactory = await ethers.getContractFactory("AIMe404Power");
  const instance = await contractFactory.deploy();
  await instance.deployed();

  console.log("AIMe404Power deployed to", instance.address);

  return instance;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployMockNFTForTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
