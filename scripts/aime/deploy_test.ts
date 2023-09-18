import { ethers } from "hardhat";
import { CountUp } from "../../typechain";

async function deployCountUpForTest(): Promise<CountUp> {
  const contractFactory = await ethers.getContractFactory("CountUp");
  const instance = await contractFactory.deploy();
  await instance.deployed();

  console.log("CountUp deployed to", instance.address);

  return instance;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployCountUpForTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
