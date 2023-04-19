import { ethers } from "hardhat";
import { expect } from "chai";
import { MockAD3, Auction, EIP5489ForInfluenceMining, HNFTGovernance, AD3} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

describe("Auction", () => {
  let auction: Auction;
  let hNFT: EIP5489ForInfluenceMining;
  let ad3Token: MockAD3;
  let governanceToken: MockAD3;
  let governance: HNFTGovernance;
  let relayer: SignerWithAddress;
  let owner: SignerWithAddress;
  let bidder1: SignerWithAddress;
  let bidder2: SignerWithAddress;
  let bidder3: SignerWithAddress;

  beforeEach(async () => {
    [owner, relayer, bidder1, bidder2, bidder3] = await ethers.getSigners();

    const Auction = await ethers.getContractFactory("Auction");
    const MockAD3 = await ethers.getContractFactory("MockAD3");
    const HNFT = await ethers.getContractFactory("EIP5489ForInfluenceMining");
    const Governance = await ethers.getContractFactory("HNFTGovernance");

    governance = await Governance.deploy();
    await governance.deployed();

    ad3Token = await MockAD3.deploy();
    await ad3Token.deployed();
    await ad3Token.mint(1000);
    await ad3Token.transfer(bidder1.address, 100);
    await ad3Token.transfer(bidder2.address, 120);
    await ad3Token.transfer(bidder3.address, 5);

    auction = await Auction.deploy(relayer.address, ad3Token.address, governance.address);
    await auction.deployed();

    governanceToken = await MockAD3.deploy();
    await governanceToken.deployed();
    await governanceToken.mint(1000);
    await governanceToken.transfer(bidder1.address, 100);
    await governanceToken.transfer(bidder2.address, 120);

    hNFT = await HNFT.deploy();
    await hNFT.deployed();

    await hNFT.mint("https://app.parami.io/hnft/ethereum/0x1/1", 0);
    hNFT.approve(auction.address, 1);

    governance.governWith(hNFT.address, 1, governanceToken.address);

  });

  describe("preBid", () => {

    it("should fail when user's balance is less than MIN_DEPOSIT", async () => {
      const hNFTId = 1;
      await expect(auction.connect(bidder3).preBid(hNFT.address, hNFTId)).to.be.revertedWith("AD3 balance not enough");
    });
    
    it("should fail when user's allowance is less than MIN_DEPOSIT", async () => {
      const hNFTId = 1;
      await expect(auction.connect(bidder2).preBid(hNFT.address, hNFTId)).to.be.revertedWith("allowance not enough");
    });
    

    it("should successfully prepare a pre-bid even if nftAddress and nftId combination doesn't exist", async () => {
      const nonExistentId = 2;
      await expect(auction.connect(bidder2).preBid(hNFT.address, nonExistentId)).to.be.revertedWith("ERC721: invalid token ID");
    });
    

    it("should allow users to preBid", async () => {
      const preBidAmount = 10;
      const beforeAd3Balance = await ad3Token.balanceOf(bidder1.address);
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      const hNFTId = 1;
      const transaction = await auction.connect(bidder1).preBid(hNFT.address,hNFTId);
      const receipt = await transaction.wait();
      const event = receipt.events?.find((e) => e.event === "BidPrepared");
      const [curBidId, preBidId] = [event!.args!.curBidId, event!.args!.preBidId];

      const preBid = await auction.preBids(hNFT.address, 1);
      const currentBid = await auction.curBid(hNFT.address, 1);
      expect(curBidId).to.equal(currentBid.bidId);
      expect(preBidId).to.be.equal(preBid.bidId);

      const afterAd3Balance = await ad3Token.balanceOf(bidder1.address);
      expect(afterAd3Balance).to.be.equal(beforeAd3Balance.sub(BigNumber.from(preBidAmount)));
    });


    it("Should not allow a new preBid while previous preBid hasn't been committed yet", async () => {
      const hNFTId = 1;

      await ad3Token.connect(bidder1).approve(auction.address, 10);
      const transaction1 = await auction.connect(bidder1).preBid(hNFT.address, hNFTId);
      const receipt1 = await transaction1.wait();
      const event1 = receipt1.events?.find((e) => e.event === "BidPrepared");
      const [curBidId1, preBidId1] = [event1!.args!.curBidId, event1!.args!.preBidId];
      expect(curBidId1).to.equal(0);
      expect(preBidId1).to.be.gt(0);

      await ad3Token.connect(bidder2).approve(auction.address, 10);
      await expect(auction.connect(bidder2).preBid(hNFT.address, hNFTId)).to.be.revertedWith("Last preBid still within the valid time");
    });

    it("Should allow a new preBid while previous preBid hasn't been committed yet and preBid timeout ", async () => {
      const hNFTId = 1;
      const preBidAmount = 10;

      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      const transaction1 = await auction.connect(bidder1).preBid(hNFT.address, hNFTId);
      const receipt1 = await transaction1.wait();
      const event1 = receipt1.events?.find((e) => e.event === "BidPrepared");
      const [curBidId1, preBidId1] = [event1!.args!.curBidId, event1!.args!.preBidId];
      expect(curBidId1).to.equal(0);
      expect(preBidId1).to.be.gt(0);

      await ethers.provider.send("evm_increaseTime", [11 * 60]);
      await ethers.provider.send("evm_mine");

      await ad3Token.connect(bidder2).approve(auction.address, preBidAmount);
      const transaction2 = await auction.connect(bidder2).preBid(hNFT.address, hNFTId);
      const receipt2 = await transaction2.wait();
      const event2 = receipt2.events?.find((e) => e.event === "BidPrepared");
      const [curBidId2, preBidId2] = [event2!.args!.curBidId, event2!.args!.preBidId];
      expect(curBidId2).to.equal(0);
      expect(preBidId2).to.be.gt(0);
      expect(preBidId2).to.not.equal(preBidId1);
    });
  });

  describe("commitBid", () => {
    it("Should fail when commitBid has a non-existent bidId", async function () {
      const preBidAmount = 10;
      const bidAmount = 100;
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      const hNFTId = 1;
      const transaction = await auction.connect(bidder1).preBid(hNFT.address,hNFTId);
      const receipt = await transaction.wait();
      const event = receipt.events?.find((e) => e.event === "BidPrepared");
      const [curBidId, preBidId] = [event!.args!.curBidId, event!.args!.preBidId];
      const errBidId = 999;
      
      const messageHash = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [1, hNFT.address, governanceToken.address, bidAmount, errBidId, preBidId]
      );
      const signature = await relayer.signMessage(ethers.utils.arrayify(messageHash));
      await governanceToken.connect(bidder1).approve(auction.address, bidAmount);
      await expect(auction.connect(bidder1).commitBid(
        {hNFTId: hNFTId, hNFTContractAddr: hNFT.address},
        bidAmount,
        "slot-uri",
        signature,
        errBidId,
        preBidId,
        0
      )).to.be.revertedWith("Invalid curBidId");
    });

    it("Should fail when signature content and input parameters or relayerAddr do not match", async function () {
      const preBidAmount = 10;
      const bidAmount = 100;
      const errorSignBidAmount = 120;
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      const hNFTId = 1;
      const transaction = await auction.connect(bidder1).preBid(hNFT.address,hNFTId);
      const receipt = await transaction.wait();
      const event = receipt.events?.find((e) => e.event === "BidPrepared");
      const [curBidId, preBidId] = [event!.args!.curBidId, event!.args!.preBidId];
      const messageHash = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [1, hNFT.address, governanceToken.address, errorSignBidAmount, curBidId, preBidId]
      );
      const signature = await relayer.signMessage(ethers.utils.arrayify(messageHash));

      await governanceToken.connect(bidder1).approve(auction.address, bidAmount);
      await expect(auction.connect(bidder1).commitBid(
        {hNFTId: hNFTId, hNFTContractAddr: hNFT.address},
        bidAmount,
        "slot-uri",
        signature,
        curBidId,
        preBidId,
        0
      )).to.be.revertedWith("Invalid Signer!");
    });

    it("Should fail when signer is not the relayerAddr", async function () {
      const preBidAmount = 10;
      const bidAmount = 100;
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      const hNFTId = 1;
      const transaction = await auction.connect(bidder1).preBid(hNFT.address,hNFTId);
      const receipt = await transaction.wait();
      const event = receipt.events?.find((e) => e.event === "BidPrepared");
      const [curBidId, preBidId] = [event!.args!.curBidId, event!.args!.preBidId];
      const messageHash = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [1, hNFT.address, governanceToken.address, bidAmount, curBidId, preBidId]
      );
      
      const signature = await bidder3.signMessage(ethers.utils.arrayify(messageHash));
    
      await governanceToken.connect(bidder1).approve(auction.address, bidAmount);
      await expect(auction.connect(bidder1).commitBid(
        {hNFTId: hNFTId, hNFTContractAddr: hNFT.address},
        bidAmount,
        "slot-uri",
        signature,
        curBidId,
        preBidId,
        0
      )).to.be.revertedWith("Invalid Signer!");
    });

    it("Should fail when signature does not exist", async function () {
      const bidAmount = 100;
      const preBidAmount = 10;
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      const hNFTId = 1;
      const transaction = await auction.connect(bidder1).preBid(hNFT.address,hNFTId);
      const receipt = await transaction.wait();
      const event = receipt.events?.find((e) => e.event === "BidPrepared");
      const [curBidId, preBidId] = [event!.args!.curBidId, event!.args!.preBidId];
      const messageHash = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [1, hNFT.address, governanceToken.address, bidAmount, curBidId, preBidId]
      );
      
      await governanceToken.connect(bidder1).approve(auction.address, bidAmount);
      await expect(auction.connect(bidder1).commitBid(
        {hNFTId: hNFTId, hNFTContractAddr: hNFT.address},
        bidAmount,
        "slot-uri",
        "0x",
        curBidId,
        preBidId,
        0
      )).to.be.revertedWith("ECDSA: invalid signature length");
    });

    it("Should success when preBid has already timed out", async () => {
      const hNFTId = 1;
      const preBidAmount = 10;
      const bidAmount = 100;

      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      const beforBalance = await ad3Token.balanceOf(bidder1.address);
      const transaction1 = await auction.connect(bidder1).preBid(hNFT.address, hNFTId);
      const receipt1 = await transaction1.wait();
      const event1 = receipt1.events?.find((e) => e.event === "BidPrepared");
      const [curBidId, preBidId] = [event1!.args!.curBidId, event1!.args!.preBidId];

      await ethers.provider.send("evm_increaseTime", [11 * 60]);
      await ethers.provider.send("evm_mine");

      await governanceToken.connect(bidder1).approve(auction.address, bidAmount);
      const messageHash = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [1, hNFT.address, governanceToken.address, bidAmount, curBidId, preBidId]
      );
      
      const signature = await relayer.signMessage(ethers.utils.arrayify(messageHash));

      const curBidRemain = 0;
      // payout 20 
      const allowanceBalance = await governanceToken.allowance(auction.address, relayer.address);

      await auction.connect(bidder1).commitBid(
        {hNFTId: hNFTId, hNFTContractAddr: hNFT.address},
        bidAmount,
        "slot-uri",
        signature,
        curBidId,
        preBidId,
        curBidRemain
      );
      const afterBalance = await ad3Token.balanceOf(bidder1.address);
      expect(beforBalance).to.equal(afterBalance);

      const auctionTokenBalance = await governanceToken.balanceOf(auction.address);
      console.log(`auctionTokenBalance: ${auctionTokenBalance}`);
      expect(auctionTokenBalance).to.equal(BigNumber.from(bidAmount - curBidRemain).add(allowanceBalance));
    });

    it ("should allow users to commitBid", async () => {
      const hNFTId = 1;
      const bidAmount = 10;
      const preBidAmount = 10;
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);

      const transaction = await auction.connect(bidder1).preBid(hNFT.address, hNFTId);
      const receipt = await transaction.wait();
      const event = receipt.events?.find((e) => e.event === "BidPrepared");
      const [curBidId, preBidId] = [event!.args!.curBidId, event!.args!.preBidId];

      await governanceToken.connect(bidder1).approve(auction.address, bidAmount);
      const messageHash = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [1, hNFT.address, governanceToken.address, bidAmount, curBidId, preBidId]
      );
      
      const signature = await relayer.signMessage(ethers.utils.arrayify(messageHash));
      
      const curBidRemain = 0;
      const allowanceBalance = await governanceToken.allowance(auction.address, relayer.address);

      await auction.connect(bidder1).commitBid(
        {hNFTId: hNFTId, hNFTContractAddr: hNFT.address},
        bidAmount,
        "slot-uri",
        signature,
        curBidId,
        preBidId,
        curBidRemain
      );
      
      const currentBid = await auction.curBid(hNFT.address, 1);
      expect(currentBid.bidId).to.equal(preBidId);
      expect(currentBid.amount).to.equal(bidAmount);
      expect(currentBid.bidder).to.equal(bidder1.address);
      
      const preBidAmountRefund = await ad3Token.balanceOf(bidder1.address);
      expect(preBidAmountRefund).to.equal(100);

      const auctionTokenBalance = await governanceToken.balanceOf(auction.address);
      expect(auctionTokenBalance).to.equal(BigNumber.from(bidAmount - curBidRemain).add(allowanceBalance));
    });

    it("should refund the previous bidder when a new bid is submitted", async () => {
      const preBidAmount1 = 10;
      const bidAmount1 = 100;
      const preBidAmount2 = 10;
      const bidAmount2 = 120;
      const hNFTId = 1;
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount1);
      
      const transaction1 = await auction.connect(bidder1).preBid(hNFT.address, hNFTId);
      const receipt1 = await transaction1.wait();
      const event1 = receipt1.events?.find((e) => e.event === "BidPrepared");
      const [curBidId1, preBidId1] = [event1!.args!.curBidId, event1!.args!.preBidId];

      await governanceToken.connect(bidder1).approve(auction.address, bidAmount1);
      const messageHash1 = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [1, hNFT.address, governanceToken.address, bidAmount1, curBidId1, preBidId1]
      );

      const signature1 = await relayer.signMessage(ethers.utils.arrayify(messageHash1));
      await auction.connect(bidder1).commitBid(
        {hNFTId: hNFTId, hNFTContractAddr: hNFT.address},
        bidAmount1,
        "slot-uri",
        signature1,
        curBidId1,
        preBidId1,
        0
      );

      const approveAmount = await governanceToken.allowance(auction.address, relayer.address);
      expect(approveAmount).to.equal(bidAmount1);

      const currentBid1 = await auction.curBid(hNFT.address, 1);
      expect(currentBid1.bidId).to.equal(preBidId1);
      expect(currentBid1.amount).to.equal(bidAmount1);
      expect(currentBid1.bidder).to.equal(bidder1.address);

      await ad3Token.connect(bidder2).approve(auction.address, preBidAmount2);

      const transaction2 = await auction.connect(bidder2).preBid(hNFT.address, hNFTId);
      const receipt2 = await transaction2.wait();
      const event2 = receipt2.events?.find((e) => e.event === "BidPrepared");
      const [curBidId2, preBidId2] = [event2!.args!.curBidId, event2!.args!.preBidId];

      await governanceToken.connect(bidder2).approve(auction.address, bidAmount2);
      const messageHash2 = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [1, hNFT.address, governanceToken.address, bidAmount2, curBidId2, preBidId2]
      );
      const signature2 = await relayer.signMessage(ethers.utils.arrayify(messageHash2));


      const curBidRemain = 80;
      // payout 20 
      await governanceToken.connect(relayer).transferFrom(auction.address, bidder3.address, 20);
      const allowanceBalance = await governanceToken.allowance(auction.address, relayer.address);
      await auction.connect(bidder2).commitBid(
        {hNFTId: hNFTId, hNFTContractAddr: hNFT.address},
        bidAmount2,
        "slot-uri",
        signature2,
        curBidId2,
        preBidId2,
        curBidRemain
      );

      const preBid1 = await auction.connect(bidder1).preBids(hNFT.address, 1);
      expect(preBid1.bidId).to.be.equal(0);
      expect(preBid1.amount).to.be.equal(0);

      const currentBid2 = await auction.curBid(hNFT.address, 1);
      expect(currentBid2.bidId).to.equal(preBidId2);
      expect(currentBid2.amount).to.equal(bidAmount2);
      expect(currentBid2.bidder).to.equal(bidder2.address);

      const bidder1Balance = await ad3Token.balanceOf(bidder1.address);
      const bidder1TokenBalance = await governanceToken.balanceOf(bidder1.address);
      expect(bidder1Balance).to.equal(100);
      expect(bidder1TokenBalance).to.equal(80);

      const bidder2Balance = await ad3Token.balanceOf(bidder2.address);
      const bidder2TokenBalance = await governanceToken.balanceOf(bidder2.address);
      expect(bidder2Balance).to.be.equal(120);
      expect(bidder2TokenBalance).to.be.equal(0);
      const auctionTokenBalance = await governanceToken.balanceOf(auction.address);
      expect(auctionTokenBalance).to.equal(BigNumber.from(bidAmount2 - curBidRemain).add(allowanceBalance));
    });
  });

  describe("relayer address management", () => {
    it("should allow the owner to get the relayer address", async () => {
      const getRelayerAddress = await auction.getRelayerAddress();
      expect(getRelayerAddress).to.equal(relayer.address);
    });

    it("should allow the owner to update the relayer address", async () => {
      const newRelayer = owner;
      await auction.connect(owner).setRelayerAddress(newRelayer.address);
      const updatedRelayerAddress = await auction.getRelayerAddress();
      expect(updatedRelayerAddress).to.equal(newRelayer.address);
    });

    it("should fail to set relayer address if not called by the owner", async () => {
      await expect(auction.connect(bidder1).setRelayerAddress(bidder2.address)).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("min deposit management", () => {
    it("should set the min deposit for pre-bid correctly", async () => {
      await auction.connect(owner).setMinDepositForPreBid(20);
  
      const newMinDeposit = await auction.getMinDepositForPreBid();
      expect(newMinDeposit).to.equal(20);
    });
  
    it("should fail to set the min deposit for pre-bid if not called by the owner", async () => {
      await expect(auction.connect(bidder1).setMinDepositForPreBid(20)).to.be.revertedWith("Ownable: caller is not the owner");
    });
  
    it("should return the correct min deposit for pre-bid", async () => {
      const returnedMinDeposit = await auction.getMinDepositForPreBid();
  
      expect(returnedMinDeposit).to.equal(10);
    });
  });
});