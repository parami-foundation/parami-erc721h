// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

async function deploy() {
  const factory = await ethers.getContractFactory("SignatureERC20Withdraw");
  const instance = await upgrades.deployProxy(factory, [
    "0xf6b2923717175185a626790FF78B6f37DAbb3565",
    5,
    "0x9F883b12fD0692714C2f28be6C40d3aFdb9081D3",
  ]);
  await instance.deployed();

  await hre.run("verify:verify", { address: instance.address });
  console.log("signature withdraw proxy deployed to", instance.address);
}

async function upgrade() {
  const contractFactory = await ethers.getContractFactory(
    "SignatureERC20Withdraw"
  );
  const instance = await upgrades.upgradeProxy("", contractFactory);
  await instance.deployed();

  console.log("withdraw proxy upgraded to ", instance.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deploy().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
