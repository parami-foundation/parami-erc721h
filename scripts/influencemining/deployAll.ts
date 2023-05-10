import { deployAd3 } from "./deployAD3";
import hre from "hardhat";
import { deployHNFT } from "./deployHNft";
import { deployAuction } from "./deployAuction";
import { deployHNFTGovernance } from "./deployGovernance";

async function deployAll(): Promise<void> {
  const accounts = await hre.ethers.getSigners();
  //1. deployAd3
  const ad3Instance = await deployAd3(accounts[0].address);

  //2. deployHNFT
  const hnftInstance = await deployHNFT(ad3Instance.address);

  //3. deployHNFTGovernance
  const hnftGovernance = await deployHNFTGovernance();

  //4. deployAuction
  const auctionInstance = await deployAuction({
    relayerAddress: accounts[0].address,
    ad3Address: ad3Instance.address,
    hnftGoverAddress: hnftGovernance.address,
  });
}

deployAll()
  .catch((error) => {
    console.error(error);
  })
  .then(() => console.log("deployAll success"));
