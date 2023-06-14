import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

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

async function upgrade() {
  const contractFactory = await ethers.getContractFactory("Auction");
  const instance = await upgrades.upgradeProxy(
    "0x6023cF66B0AD3e79D942c2a66B368C921632D1c2",
    contractFactory
  );
  await instance.deployed();

  await hre.run("verify:verify", { address: instance.address });

  console.log("auction proxy upgraded to ", instance.address);
}

// deployAuction({
//   relayerAddress: "0x9F883b12fD0692714C2f28be6C40d3aFdb9081D3",
//   ad3Address: "0xf6b2923717175185a626790FF78B6f37DAbb3565",
//   hnftGoverAddress: "0x7c3826180814518C7d7765b1ECE11eDB708a7850",
// }).catch((error) => {
//   console.error(error);
//   process.exitCode = 1;
// });

upgrade().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
