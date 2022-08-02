// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy

  const ERC721HCollectionFactory = await ethers.getContractFactory("ERC721HCollection");
  const erc721HCollection = await ERC721HCollectionFactory.deploy();

  const ERC721WRegistryFactory= await ethers.getContractFactory("ERC721WRegistry");
  const erc721WRegistry = await ERC721WRegistryFactory.deploy();

  const ParamiLinkFactory = await ethers.getContractFactory("ParamiLink");
  const paramiLink = await ParamiLinkFactory.deploy();

  await erc721HCollection.deployed();
  await erc721WRegistry.deployed();
  await paramiLink.deployed();

  console.log("erc721wregistry deployed to:", erc721WRegistry.address);
  console.log("erc721hCollection deployed to:", erc721HCollection.address);
  console.log("parami link deployed to:", paramiLink.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
