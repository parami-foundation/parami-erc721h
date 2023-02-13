// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";

async function deploy() {
  const factory = await ethers.getContractFactory(
    "EIP5489ForInfluenceMining"
  );
  const instance = await upgrades.deployProxy(factory, ["0xf6b2923717175185a626790FF78B6f37DAbb3565"]);
  await instance.deployed();

  console.log("eip5489 influence mining proxy deployed to", instance.address);
}

async function upgrade() {
  const contractFactory = await ethers.getContractFactory(
    "EIP5489ForInfluenceMining"
  );
  const instance = await upgrades.upgradeProxy(
    "0x38e151C51fa45779a4DF8Ce0b7F9E051fF389D99",
    contractFactory
  );
  await instance.deployed();

  console.log("eip5489 influence minging proxy upgraded to ", instance.address);
}

const validate = async () => {
  const contractFactory = await ethers.getContractFactory(
    "EIP5489ForInfluenceMining"
  );
  const instance = await upgrades.validateUpgrade(
    "0x38e151C51fa45779a4DF8Ce0b7F9E051fF389D99",
    contractFactory
  );
};
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deploy().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
