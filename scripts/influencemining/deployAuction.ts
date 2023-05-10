import { ethers, upgrades } from "hardhat";

export async function deployAuction(options: {
  relayerAddress: string;
  ad3Address: string;
  hnftGoverAddress: string;
}) {
  const factory = await ethers.getContractFactory("Auction");
  const signer = await ethers.getSigners();
  console.log(signer[0].address);
  const instance = await upgrades.deployProxy(factory, [
    options.relayerAddress,
    options.ad3Address,
    options.hnftGoverAddress,
  ]);
  await instance.deployed();

  console.log("auction proxy deployed to", instance.address);
  return instance;
}

deployAuction({
  relayerAddress: "0x971dF9552669c3890AFE88Cb0a068C98a9A60B7C",
  ad3Address: "0xf6b2923717175185a626790FF78B6f37DAbb3565",
  hnftGoverAddress: "0x7c3826180814518C7d7765b1ECE11eDB708a7850",
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
