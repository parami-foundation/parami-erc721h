import { ethers } from "hardhat";

export async function deployHNFTGovernance() {
  const Governance = await ethers.getContractFactory("HNFTGovernance");
  const hnftGovernance = await Governance.deploy();
  await hnftGovernance.deployed();
  console.log(`HNFTGovernance deployed to ${hnftGovernance.address}`);
  return hnftGovernance;
}

deployHNFTGovernance().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
