// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";
import { SignatureERC20Withdraw } from "../../typechain";

async function deploy() {
  const factory = await ethers.getContractFactory("SignatureERC20Withdraw");
  const instance = await upgrades.deployProxy(factory, [
    "0x69E6f759583b839b806b7BD20882376829CA37D8",
    5,
    "0x9F883b12fD0692714C2f28be6C40d3aFdb9081D3",
  ]);
  await instance.deployed();

  console.log("signature withdraw proxy deployed to", instance.address);
}

async function upgrade() {
  const factory = await ethers.getContractFactory("SignatureERC20Withdraw");
  const instance = (await upgrades.upgradeProxy(
    "0x1857EDf319E40cD231af46e1b72DA5f9725051aF",
    factory
  )) as SignatureERC20Withdraw;
  await instance.deployed();

  await instance.manageInitializerParams(
    "0x69E6f759583b839b806b7BD20882376829CA37D8",
    5,
    "0x9F883b12fD0692714C2f28be6C40d3aFdb9081D3"
  );

  console.log("signature withdraw proxy deployed to", instance.address);
}

const validate = async () => {
  const contractFactory = await ethers.getContractFactory(
    "SignatureERC20Withdraw"
  );
  const instance = await upgrades.validateUpgrade(
    "0x1857EDf319E40cD231af46e1b72DA5f9725051aF",
    contractFactory
  );
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
upgrade().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
