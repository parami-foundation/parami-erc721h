import { ethers } from "hardhat";
import { expect } from "chai";
import { HNFTGovernanceToken, HNFTGovernance, EIP5489ForInfluenceMining} from "../typechain";
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
    hnftGovernance = await HNFTGovernance.deploy();
    await hnftGovernance.deployed();
  });

  it("should allow NFT owner to issue a token", async () => {
    const tokenId = 1;

    const origin = await hnftGovernance.getGovernanceToken(hnftContract.address, tokenId);

    expect(origin).to.equal("0x0000000000000000000000000000000000000000");

    await hnftGovernance.connect(owner).issueGovernanceToken(hnftContract.address, tokenId, "MGB", "MGB")

    const address = await hnftGovernance.getGovernanceToken(hnftContract.address, tokenId);
    
    expect(address).to.equal(await hnftGovernance.connect(owner).getGovernanceToken(hnftContract.address, tokenId));
  
  });

  it("should not allow non-owner to issue a token", async () => {
    const tokenId = 1;
    await expect(
      hnftGovernance.connect(addr1).issueGovernanceToken(hnftContract.address, tokenId, "MGB", "MGB")
    ).to.be.revertedWith("Only the NFT owner can issue governance token");
  });

  it("should emit event when NFT is issued", async () => {
    const tokenId = 1;

    await expect(hnftGovernance.connect(owner).issueGovernanceToken(hnftContract.address, tokenId, "MGB", "MGB"))
      .to.emit(hnftGovernance, "Governance")
      .withArgs(tokenId, await hnftGovernance.connect(owner).getGovernanceToken(hnftContract.address, tokenId));
  });
  
});
