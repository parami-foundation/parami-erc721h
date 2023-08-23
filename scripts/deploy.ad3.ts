import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const erc721HBatchCollection = await ethers.getContractFactory("AD3");
  const instance = await erc721HBatchCollection.deploy(10000, "AD3", "AD3", deployer.address, deployer.address, 10000, deployer.address);
  await instance.deployed()

  console.log("proxy deployed to", instance.address)
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
