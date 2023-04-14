import { ethers } from "hardhat";
import { expect } from "chai";
import { MockAD3, Auction, EIP5489ForInfluenceMining} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Auction", () => {
  let auction: Auction;
  let hNFT: EIP5489ForInfluenceMining;
  let token: MockAD3;
  let relayer: SignerWithAddress;
  let owner: SignerWithAddress;
  let bidder1: SignerWithAddress;
  let bidder2: SignerWithAddress;

  beforeEach(async () => {
    [owner, relayer, bidder1, bidder2] = await ethers.getSigners();

    const Auction = await ethers.getContractFactory("Auction");
    const MockAD3 = await ethers.getContractFactory("MockAD3");
    const HNFT = await ethers.getContractFactory("EIP5489ForInfluenceMining");

    auction = await Auction.deploy(relayer.address);
    await auction.deployed();

    token = await MockAD3.deploy();
    await token.deployed();
    await token.mint(1000);

    await token.transfer(bidder1.address, 100);
    await token.transfer(bidder2.address, 120);

    hNFT = await HNFT.deploy();
    await hNFT.deployed();

    await hNFT.mint("https://app.parami.io/hnft/ethereum/0x1/1", 0);

    hNFT.approve(auction.address, 1);
  });

  it("should place a new bid", async () => {
    await token.connect(bidder1).approve(auction.address, 100);
    await auction.connect(bidder1).bid(1, hNFT.address, token.address, 100, "new-uri");

    const highestBid = await auction.highestBid(1);
    expect(highestBid.amount).to.equal(100);
    expect(highestBid.bidder).to.equal(bidder1.address);
  });

  it("should refund previous bidder and place a new bid", async () => {
    await token.connect(bidder1).approve(auction.address, 100);
    await auction.connect(bidder1).bid(1, hNFT.address, token.address, 100, "new-uri");

    const previousBidderBalance = await token.balanceOf(bidder1.address);

    await token.connect(bidder2).approve(auction.address, 120);
    await auction.connect(bidder2).bid(1, hNFT.address, token.address, 120, "new-uri");

    const newBidderBalance = await token.balanceOf(bidder1.address);
    expect(newBidderBalance.sub(previousBidderBalance)).to.equal(100);

    const highestBid = await auction.highestBid(1);
    expect(highestBid.amount).to.equal(120);
    expect(highestBid.bidder).to.equal(bidder2.address);
  });

  it("should relayeraddress can use auction token", async () => {
    await token.connect(bidder1).approve(auction.address, 100);
    await auction.connect(bidder1).bid(1, hNFT.address, token.address, 100, "new-uri");
    
    expect(await token.balanceOf(auction.address)).to.equal(100);
    expect(await token.balanceOf(relayer.address)).to.equal(0);

    await token.connect(relayer).transferFrom(auction.address, relayer.address, 100);

    expect(await token.balanceOf(auction.address)).to.equal(0);
    expect(await token.balanceOf(relayer.address)).to.equal(100);
  });
});
