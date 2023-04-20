import { ethers } from "hardhat";

async function deploy() {
  const Governance = await ethers.getContractFactory(
    "HNFTGovernance"
  );
  const hnftGovernance = await Governance.deploy();
  await hnftGovernance.deployed();
  console.log(`HNFTGovernance deployed to ${hnftGovernance.address}`);
}

deploy().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
