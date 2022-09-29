// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers,upgrades } from "hardhat";

async function main() {
  const erc721HBatchCollection = await ethers.getContractFactory("ERC721HBatchCollection");
  const instance = await upgrades.deployProxy(erc721HBatchCollection, ["https://airdrop.parami.io/baseURI/", "https://airdrop.parami.io/baseSlotURI/", 100010]);
  await instance.deployed()

  console.log("proxy deployed to", instance.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
