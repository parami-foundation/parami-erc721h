import { ethers, upgrades } from "hardhat";

async function deploy() {
  const factory = await ethers.getContractFactory(
    "Auction"
  );
  const signer = await ethers.getSigners();
  console.log(signer[0].address)
  const instance = await upgrades.deployProxy(factory, ["0x971dF9552669c3890AFE88Cb0a068C98a9A60B7C", "0xf6b2923717175185a626790FF78B6f37DAbb3565", "0x22CD32e81a43a8d99420f1fB6B47834039C58457"]);
  await instance.deployed();

  await instance.transferOwnership("0x971dF9552669c3890AFE88Cb0a068C98a9A60B7C");

  console.log("auction proxy deployed to", instance.address);
}

deploy().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
