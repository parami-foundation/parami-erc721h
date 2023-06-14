import { ethers } from "hardhat";

export async function deployHNFTGovernanceToken() {
  const GovernanceToken = await ethers.getContractFactory("HNFTGovernanceToken");
  const hnftGovernanceToken = await GovernanceToken.deploy('KK NFT', 'KKNFT');
  await hnftGovernanceToken.deployed();
  console.log(`HNFTGovernanceToken deployed to ${hnftGovernanceToken.address}`);
  return hnftGovernanceToken;
}

deployHNFTGovernanceToken().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});