// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";

async function deploy() {
  const factory = await ethers.getContractFactory("SignatureERC20Withdraw");
  const instance = await upgrades.deployProxy(factory, [
    "0x69E6f759583b839b806b7BD20882376829CA37D8",
    5,
  ]);
  await instance.deployed();

  console.log("signature withdraw proxy deployed to", instance.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deploy().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
