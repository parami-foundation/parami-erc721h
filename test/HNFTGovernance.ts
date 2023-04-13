import { ethers } from "hardhat";
import { expect } from "chai";
import { HNFTGovernanceToken, HNFTGovernance, EIP5489ForInfluenceMining} from "../typechain/";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("HNFTGovernance", () => {
  let hnftGovernance: HNFTGovernance;
  let hnftGovernanceToken: HNFTGovernanceToken;
  let hnftContract: EIP5489ForInfluenceMining;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  beforeEach(async () => {
    [owner, addr1] = await ethers.getSigners();

    const EIP5489ForInfluenceMining = await ethers.getContractFactory("EIP5489ForInfluenceMining");
    hnftContract = await EIP5489ForInfluenceMining.deploy();
    await hnftContract.deployed();

    hnftContract.mint("https://app.parami.io/hnft/ethereum/0x1/1", 0);

    const HNFTGovernanceToken = await ethers.getContractFactory("HNFTGovernanceToken");
    hnftGovernanceToken = await HNFTGovernanceToken.deploy("AD3 Token", "AD3");
    await hnftGovernanceToken.deployed();

    const HNFTGovernance = await ethers.getContractFactory("HNFTGovernance");
    hnftGovernance = await HNFTGovernance.deploy(hnftContract.address);
    await hnftGovernance.deployed();
  });

  it("should allow NFT owner to fragment and govern with token", async () => {
    const tokenId = 1;
    await hnftGovernance.connect(owner).governWith(tokenId, hnftGovernanceToken.address);

    expect(await hnftGovernance.getGovernanceToken(tokenId)).to.equal(hnftGovernanceToken.address);
  });

  it("should not allow non-owner to fragment and govern with token", async () => {
    const tokenId = 1;
    await expect(
      hnftGovernance.connect(addr1).governWith(tokenId, hnftGovernanceToken.address)
    ).to.be.revertedWith("Only the NFT owner can fragment");
  });

  it("should emit event when NFT is fragmented", async () => {
    const tokenId = 1;

    await expect(hnftGovernance.connect(owner).governWith(tokenId, hnftGovernanceToken.address))
      .to.emit(hnftGovernance, "FragmentGovernance")
      .withArgs(tokenId, hnftGovernanceToken.address);
  });

  it("should return the correct hnftGovernanceToken address", async () => {
    const tokenId = 1;
    await hnftGovernance.connect(owner).governWith(tokenId, hnftGovernanceToken.address)
    await expect(hnftGovernance.getGovernanceToken(tokenId)).to.equal(hnftGovernanceToken.address);
  });
});
