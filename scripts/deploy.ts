// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers,upgrades } from "hardhat";

async function main() {
  const erc721HBatchCollection = await ethers.getContractFactory("ERC721HBatchCollection");
  const instance = await upgrades.deployProxy(erc721HBatchCollection, ["https://airdrop.parami.io/hnft/", "https://app.parami.io/hnft/ethereum/", 100000]);
  await instance.deployed();

  console.log("proxy deployed to", instance.address);
}

async function deployParamiRegistry() {
  const paramiRegistryFactory = await ethers.getContractFactory("ParamiRegistry");
  console.log('Deploying ParamiRegistry...');
  const instance = await upgrades.deployProxy(paramiRegistryFactory, ["0xD5a6a05cCf0F027c291A4B66B6b3B0086b1A22a7"]);
  await instance.deployed();

  console.log("parami registry proxy deployed to:", instance.address);
}

async function deployMockAD3() {
  const mockAD3Factory = await ethers.getContractFactory("MockAD3");
  const mockAD3 = await mockAD3Factory.deploy();
  await mockAD3.deployed();
  console.log('Mock AD3 deployed to:', mockAD3.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployParamiRegistry().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
