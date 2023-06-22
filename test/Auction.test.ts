import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import {
  MockAD3,
  Auction,
  EIP5489ForInfluenceMining,
  HNFTGovernance,
  HNFTGovernanceToken,
  AD3,
  ERC20,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { string } from "hardhat/internal/core/params/argumentTypes";

describe("Auction", () => {
  let auction: Auction;
  let hNFT: EIP5489ForInfluenceMining;
  let ad3Token: MockAD3;
  let governanceToken: ERC20;
  let governance: HNFTGovernance;
  let relayer: SignerWithAddress;
  let owner: SignerWithAddress;
  let bidder1: SignerWithAddress;
  let bidder2: SignerWithAddress;
  let bidder3: SignerWithAddress;

  beforeEach(async () => {
    [owner, relayer, bidder1, bidder2, bidder3] = await ethers.getSigners();

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

    const factory = await ethers.getContractFactory("Auction");
    auction = (await upgrades.deployProxy(factory, [
      relayer.address,
      ad3Token.address,
      governance.address,
    ])) as Auction;
    await auction.deployed();

    hNFT = await HNFT.deploy();
    await hNFT.deployed();

    await hNFT.mint("https://app.parami.io/hnft/ethereum/0x1/1", 0);
    hNFT.authorizeSlotTo(1, auction.address);

  });

  describe("preBid", () => {
    it("should fail when user's balance is less than MIN_DEPOSIT", async () => {
      const hNFTId = 1;
      await expect(
        auction.connect(bidder3).preBid(hNFT.address, hNFTId)
      ).to.be.revertedWith("AD3 balance not enough");
    });

    it("should fail when user's allowance is less than MIN_DEPOSIT", async () => {
      const hNFTId = 1;
      await expect(
        auction.connect(bidder2).preBid(hNFT.address, hNFTId)
      ).to.be.revertedWith("allowance not enough");
    });

    it("should fail prepare a pre-bid even if nftAddress and nftId combination doesn't exist", async () => {
      const nonExistentId = 2;
      ad3Token.connect(bidder2).approve(auction.address, 10);
      await expect(
        auction.connect(bidder2).preBid(hNFT.address, nonExistentId)
      ).to.be.revertedWith("not slotManager or hnftId not exist");
    });

    it("should allow users to preBid with added governanceToken", async () => {
      
      //issue governance token first
      governance.issueGovernanceToken(hNFT.address, 1, "Mock GT", "MGT");
      const preBidAmount = 10;
      const beforeAd3Balance = await ad3Token.balanceOf(bidder1.address);
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      const hNFTId = 1;
      await auction.connect(bidder1).preBid(hNFT.address, hNFTId);
      const prePareBidInfo: PrepareBidInfo = await auction.getPrepareBidInfo(
        hNFT.address,
        hNFTId
      );
      const preBid = await auction.preBids(hNFT.address, 1);
      const currentBid = await auction.curBid(hNFT.address, 1);
      const governanceTokenAddr = await governance.getGovernanceToken(
        hNFT.address,
        1
      );
      expect(prePareBidInfo.curBidId).to.equal(currentBid.bidId);
      expect(prePareBidInfo.bidId).to.be.equal(preBid.bidId);
      expect(prePareBidInfo.governanceTokenAddr).to.be.equal(
        governanceTokenAddr
      );
      const afterAd3Balance = await ad3Token.balanceOf(bidder1.address);
      expect(afterAd3Balance).to.be.equal(
        beforeAd3Balance.sub(BigNumber.from(preBidAmount))
      );
    });

    it("Should allow users to preBid without governanceToken", async () => {
      const preBidAmount = 10;
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      const hNFTId = 1;
      await auction.connect(bidder1).preBid(hNFT.address, hNFTId);
      const prePareBidInfo: PrepareBidInfo = await auction.getPrepareBidInfo(
        hNFT.address,
        hNFTId
      );
      const preBid = await auction.preBids(hNFT.address, 1);
      const currentBid = await auction.curBid(hNFT.address, 1);
      expect(prePareBidInfo.curBidId).to.equal(currentBid.bidId);
      expect(prePareBidInfo.bidId).to.be.equal(preBid.bidId);
      expect(prePareBidInfo.governanceTokenAddr).to.be.equal(ad3Token.address);
    });

    it("Should fail when a new preBid while previous preBid hasn't been committed yet", async () => {
      const hNFTId = 1;

      await ad3Token.connect(bidder1).approve(auction.address, 10);
      const transaction1 = await auction
        .connect(bidder1)
        .preBid(hNFT.address, hNFTId);
      const receipt1 = await transaction1.wait();
      const event1 = receipt1.events?.find((e) => e.event === "BidPrepared");
      const [curBidId1, preBidId1] = [
        event1!.args!.curBidId,
        event1!.args!.preBidId,
      ];
      expect(curBidId1).to.equal(0);
      expect(preBidId1).to.be.gt(0);

      await ad3Token.connect(bidder2).approve(auction.address, 10);
      await expect(
        auction.connect(bidder2).preBid(hNFT.address, hNFTId)
      ).to.be.revertedWith("Last preBid still within the valid time");
    });

    it("Should allow a new preBid while previous preBid hasn't been committed yet and preBid timeout ", async () => {

      const hNFTId = 1;
      const preBidAmount = 10;

      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      await auction.connect(bidder1).preBid(hNFT.address, hNFTId);
      const prePareBidInfo: PrepareBidInfo = await auction.getPrepareBidInfo(
        hNFT.address,
        hNFTId
      );
      expect(prePareBidInfo.curBidId).to.equal(0);
      expect(prePareBidInfo.bidId).to.be.gt(0);

      await ethers.provider.send("evm_increaseTime", [11 * 60]);
      await ethers.provider.send("evm_mine", []);

      await ad3Token.connect(bidder2).approve(auction.address, preBidAmount);
      const transaction2 = await auction
        .connect(bidder2)
        .preBid(hNFT.address, hNFTId);
      const receipt2 = await transaction2.wait();
      const event2 = receipt2.events?.find((e) => e.event === "BidPrepared");
      const [curBidId2, preBidId2] = [
        event2!.args!.curBidId,
        event2!.args!.preBidId,
      ];
      expect(curBidId2).to.equal(0);
      expect(preBidId2).to.be.gt(0);
      expect(preBidId2).to.not.equal(prePareBidInfo.bidId);
    });

    it("Should allow users to withdraw prebid token if they don't commitBid after other user prebid", async () => {
      const hNFTId = 1;
      const preBidAmount = 10;

      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      await auction.connect(bidder1).preBid(hNFT.address, hNFTId);
      const prePareBidInfo: PrepareBidInfo = await auction.getPrepareBidInfo(
        hNFT.address,
        hNFTId
      );
      expect(prePareBidInfo.curBidId).to.equal(0);
      expect(prePareBidInfo.bidId).to.be.gt(0);

      await ethers.provider.send("evm_increaseTime", [11 * 60]);
      await ethers.provider.send("evm_mine", []);

      await ad3Token.connect(bidder2).approve(auction.address, preBidAmount);
      await auction.connect(bidder2).preBid(hNFT.address, hNFTId);

      const savedBidder1PrebidAmount = await auction.connect(bidder1).preBidsAmount(hNFT.address, hNFTId, bidder1.address);
      expect(savedBidder1PrebidAmount).to.be.equal(preBidAmount);

      const withdrawAction = await auction.connect(bidder1).withdrawPreBidAmount(hNFT.address, hNFTId);

      const afterWithdrawPreBidAmount = await auction.connect(bidder1).preBidsAmount(hNFT.address, hNFTId, bidder1.address);

      expect(afterWithdrawPreBidAmount).to.be.equal(0)
    });

    it("Should allow users to withdraw prebid token after timeout", async () => {
      const hNFTId = 1;
      const preBidAmount = 10;

      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      await auction.connect(bidder1).preBid(hNFT.address, hNFTId);
      const prePareBidInfo: PrepareBidInfo = await auction.getPrepareBidInfo(
        hNFT.address,
        hNFTId
      );
      expect(prePareBidInfo.curBidId).to.equal(0);
      expect(prePareBidInfo.bidId).to.be.gt(0);

      await ethers.provider.send("evm_increaseTime", [11 * 60]);
      await ethers.provider.send("evm_mine", []);

      const withdrawAction = await auction.connect(bidder1).withdrawPreBidAmount(hNFT.address, hNFTId);

      const afterWithdrawPreBidAmount = await auction.connect(bidder1).preBidsAmount(hNFT.address, hNFTId, bidder1.address);

      expect(afterWithdrawPreBidAmount).to.be.equal(0)
    });

    it("Should fail when user withdraw prebid token when prebid not timeout", async () => {
      const hNFTId = 1;
      const preBidAmount = 10;

      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      await auction.connect(bidder1).preBid(hNFT.address, hNFTId);
      const prePareBidInfo: PrepareBidInfo = await auction.getPrepareBidInfo(
        hNFT.address,
        hNFTId
      );
      expect(prePareBidInfo.curBidId).to.equal(0);
      expect(prePareBidInfo.bidId).to.be.gt(0);
      
      await expect(
        auction.connect(bidder1).withdrawPreBidAmount(hNFT.address, hNFTId)
      ).to.be.revertedWith("Your last preBid still within the valid time");
    });
  });

  describe("commitBid", () => {
    it("Should fail when commitBid has a non-existent bidId", async function () {
      //issue governance token first
      governance.issueGovernanceToken(hNFT.address, 1, "Mock GT", "MGT");
      const governanceTokenAddr = await governance.getGovernanceToken(hNFT.address, 1);
      governanceToken = await ethers.getContractAt("HNFTGovernanceToken", governanceTokenAddr, owner);
      const preBidAmount = 10;
      const bidAmount = 100;
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      const hNFTId = 1;
      const transaction = await auction
        .connect(bidder1)
        .preBid(hNFT.address, hNFTId);
      const receipt = await transaction.wait();
      const event = receipt.events?.find((e) => e.event === "BidPrepared");
      const [curBidId, preBidId] = [
        event!.args!.curBidId,
        event!.args!.preBidId,
      ];
      const errBidId = 999;

      const messageHash = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [
          1,
          hNFT.address,
          governanceToken.address,
          bidAmount,
          errBidId,
          preBidId,
        ]
      );
      const signature = await relayer.signMessage(
        ethers.utils.arrayify(messageHash)
      );
      await governanceToken
        .connect(bidder1)
        .approve(auction.address, bidAmount);
      await expect(
        auction
          .connect(bidder1)
          .commitBid(
            { hNFTId: hNFTId, hNFTContractAddr: hNFT.address },
            bidAmount,
            "slot-uri",
            signature,
            errBidId,
            preBidId,
            0
          )
      ).to.be.revertedWith("Invalid curBidId");
    });

    it("Should fail when signature content and input parameters or relayerAddr do not match", async function () {

      const governanceTokenAddr = await governance.getGovernanceToken(hNFT.address, 1);

      if (governanceTokenAddr == ethers.constants.AddressZero) {
        governanceToken = ad3Token
      } else {
        governanceToken = await ethers.getContractAt("HNFTGovernanceToken", governanceTokenAddr, owner);
      }
    
      const preBidAmount = 10;
      const bidAmount = 90;
      const errorSignBidAmount = 120;
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      const hNFTId = 1;
      await auction.connect(bidder1).preBid(hNFT.address, hNFTId);
      const prePareBidInfo: PrepareBidInfo = await auction.getPrepareBidInfo(
        hNFT.address,
        hNFTId
      );
      const messageHash = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [
          1,
          hNFT.address,
          ad3Token.address,
          errorSignBidAmount,
          prePareBidInfo.curBidId,
          prePareBidInfo.bidId,
        ]
      );
      const signature = await relayer.signMessage(
        ethers.utils.arrayify(messageHash)
      );

      await governanceToken
        .connect(bidder1)
        .approve(auction.address, bidAmount);
      await expect(
        auction
          .connect(bidder1)
          .commitBid(
            { hNFTId: hNFTId, hNFTContractAddr: hNFT.address },
            bidAmount,
            "slot-uri",
            signature,
            prePareBidInfo.curBidId,
            prePareBidInfo.bidId,
            0
          )
      ).to.be.revertedWith("Invalid Signer!");
    });

    it("Should fail when signer is not the relayerAddr", async function () {

      const governanceTokenAddr = await governance.getGovernanceToken(hNFT.address, 1);
      if (governanceTokenAddr == ethers.constants.AddressZero) {
        governanceToken = ad3Token
      } else {
        governanceToken = await ethers.getContractAt("HNFTGovernanceToken", governanceTokenAddr, owner);
      }

      const preBidAmount = 10;
      const bidAmount =90;
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      const hNFTId = 1;
      const transaction = await auction
        .connect(bidder1)
        .preBid(hNFT.address, hNFTId);
      const receipt = await transaction.wait();
      const event = receipt.events?.find((e) => e.event === "BidPrepared");
      const [curBidId, preBidId] = [
        event!.args!.curBidId,
        event!.args!.preBidId,
      ];
      const messageHash = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [
          1,
          hNFT.address,
          governanceToken.address,
          bidAmount,
          curBidId,
          preBidId,
        ]
      );

      const signature = await bidder3.signMessage(
        ethers.utils.arrayify(messageHash)
      );

      await governanceToken
        .connect(bidder1)
        .approve(auction.address, bidAmount);
      await expect(
        auction
          .connect(bidder1)
          .commitBid(
            { hNFTId: hNFTId, hNFTContractAddr: hNFT.address },
            bidAmount,
            "slot-uri",
            signature,
            curBidId,
            preBidId,
            0
          )
      ).to.be.revertedWith("Invalid Signer!");
    });

    it("Should fail when signature does not exist", async function () {

      const governanceTokenAddr = await governance.getGovernanceToken(hNFT.address, 1);

      if (governanceTokenAddr == ethers.constants.AddressZero) {
        governanceToken = ad3Token
      } else {
        governanceToken = await ethers.getContractAt("HNFTGovernanceToken", governanceTokenAddr, owner);
      }

      const bidAmount = 90;
      const preBidAmount = 10;
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      const hNFTId = 1;
      const transaction = await auction
        .connect(bidder1)
        .preBid(hNFT.address, hNFTId);
      const receipt = await transaction.wait();
      const event = receipt.events?.find((e) => e.event === "BidPrepared");
      const [curBidId, preBidId] = [
        event!.args!.curBidId,
        event!.args!.preBidId,
      ];
      const messageHash = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [
          1,
          hNFT.address,
          governanceToken.address,
          bidAmount,
          curBidId,
          preBidId,
        ]
      );

      await governanceToken
        .connect(bidder1)
        .approve(auction.address, bidAmount);
      await expect(
        auction
          .connect(bidder1)
          .commitBid(
            { hNFTId: hNFTId, hNFTContractAddr: hNFT.address },
            bidAmount,
            "slot-uri",
            "0x",
            curBidId,
            preBidId,
            0
          )
      ).to.be.revertedWith("ECDSA: invalid signature length");
    });

    it("Should success when preBid has already timed out", async () => {
   
      const governanceTokenAddr = await governance.getGovernanceToken(hNFT.address, 1);

      if (governanceTokenAddr == ethers.constants.AddressZero) {
        governanceToken = ad3Token
      } else {
        governanceToken = await ethers.getContractAt("HNFTGovernanceToken", governanceTokenAddr, owner);
      }

      const hNFTId = 1;
      const preBidAmount = 10;
      const bidAmount = 90;

      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);
      const beforBalance = await ad3Token.balanceOf(bidder1.address);
      const transaction1 = await auction
        .connect(bidder1)
        .preBid(hNFT.address, hNFTId);
      const receipt1 = await transaction1.wait();
      const event1 = receipt1.events?.find((e) => e.event === "BidPrepared");
      const [curBidId, preBidId] = [
        event1!.args!.curBidId,
        event1!.args!.preBidId,
      ];

      await ethers.provider.send("evm_increaseTime", [11 * 60]);
      await ethers.provider.send("evm_mine", []);

      await governanceToken
        .connect(bidder1)
        .approve(auction.address, bidAmount);
      const messageHash = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [
          1,
          hNFT.address,
          governanceToken.address,
          bidAmount,
          curBidId,
          preBidId,
        ]
      );

      const signature = await relayer.signMessage(
        ethers.utils.arrayify(messageHash)
      );

      const curBidRemain = 0;
      // payout 20
      const allowanceBalanceBefore = await governanceToken.allowance(
        auction.address,
        relayer.address
      );

      await auction
        .connect(bidder1)
        .commitBid(
          { hNFTId: hNFTId, hNFTContractAddr: hNFT.address },
          bidAmount,
          "slot-uri",
          signature,
          curBidId,
          preBidId,
          curBidRemain
        );
      const afterBalance = await ad3Token.balanceOf(bidder1.address);

      expect(beforBalance).to.equal(afterBalance.add(bidAmount));

      const auctionTokenBalance = await governanceToken.balanceOf(
        auction.address
      );
      const allowanceBalanceAfter = await governanceToken.allowance(
        auction.address,
        relayer.address
      );

      expect(auctionTokenBalance).to.equal(
        BigNumber.from(bidAmount - curBidRemain).add(allowanceBalanceBefore)
      );

      expect(allowanceBalanceAfter).to.equal(
        BigNumber.from(bidAmount - curBidRemain).add(allowanceBalanceBefore)
      );
    });

    it("should allow users to commitBid with added governance token", async () => {

      governance.issueGovernanceToken(hNFT.address, 1, "Mock GT", "MGT");

      const governanceTokenAddr = await governance.getGovernanceToken(hNFT.address, 1);

      governanceToken = await ethers.getContractAt("HNFTGovernanceToken", governanceTokenAddr, owner);

      governanceToken.connect(owner).transfer(bidder1.address, 1000)

      const hNFTId = 1;
      const bidAmount = 100;
      const preBidAmount = 100;
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);

      await auction.connect(bidder1).preBid(hNFT.address, hNFTId);
      const prePareBidInfo: PrepareBidInfo = await auction.getPrepareBidInfo(
        hNFT.address,
        hNFTId
      );

      await governanceToken
        .connect(bidder1)
        .approve(auction.address, bidAmount);
      const messageHash = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [
          1,
          hNFT.address,
          governanceToken.address,
          bidAmount,
          prePareBidInfo.curBidId,
          prePareBidInfo.bidId,
        ]
      );

      const signature = await relayer.signMessage(
        ethers.utils.arrayify(messageHash)
      );

      const curBidRemain = 0;
      const allowanceBalanceBefore = await governanceToken.allowance(
        auction.address,
        relayer.address
      );

      await auction
        .connect(bidder1)
        .commitBid(
          { hNFTId: hNFTId, hNFTContractAddr: hNFT.address },
          bidAmount,
          "slot-uri",
          signature,
          prePareBidInfo.curBidId,
          prePareBidInfo.bidId,
          curBidRemain
        );

      const currentBid = await auction.curBid(hNFT.address, 1);
      expect(currentBid.bidId).to.equal(prePareBidInfo.bidId);
      expect(currentBid.amount).to.equal(bidAmount);
      expect(currentBid.bidder).to.equal(bidder1.address);

      const preBidAmountRefund = await ad3Token.balanceOf(bidder1.address);
      expect(preBidAmountRefund).to.equal(100);

      const auctionTokenBalance = await governanceToken.balanceOf(
        auction.address
      );
      const allowanceBalanceAfter = await governanceToken.allowance(
        auction.address,
        relayer.address
      );

      expect(auctionTokenBalance).to.equal(
        BigNumber.from(bidAmount - curBidRemain).add(allowanceBalanceBefore)
      );
      expect(allowanceBalanceAfter).to.equal(
        BigNumber.from(bidAmount - curBidRemain).add(allowanceBalanceBefore)
      );
    });

    it("should allow users to commitBid with AD3 token as governance token", async () => {

      const governanceTokenAddr = await governance.getGovernanceToken(hNFT.address, 1);

      if (governanceTokenAddr == ethers.constants.AddressZero) {
        governanceToken = ad3Token
      } else {
        governanceToken = await ethers.getContractAt("HNFTGovernanceToken", governanceTokenAddr, owner);
      }

      const hNFTId = 1;
      const bidAmount = 10;
      const preBidAmount = 10;
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount);

      await auction.connect(bidder1).preBid(hNFT.address, hNFTId);
      const prePareBidInfo: PrepareBidInfo = await auction.getPrepareBidInfo(
        hNFT.address,
        hNFTId
      );

      await ad3Token
        .connect(bidder1)
        .approve(auction.address, bidAmount);
      const messageHash = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [
          1,
          hNFT.address,
          ad3Token.address,
          bidAmount,
          prePareBidInfo.curBidId,
          prePareBidInfo.bidId,
        ]
      );

      const signature = await relayer.signMessage(
        ethers.utils.arrayify(messageHash)
      );

      const curBidRemain = 0;
      const allowanceBalanceBefore = await governanceToken.allowance(
        auction.address,
        relayer.address
      );

      await auction
        .connect(bidder1)
        .commitBid(
          { hNFTId: hNFTId, hNFTContractAddr: hNFT.address },
          bidAmount,
          "slot-uri",
          signature,
          prePareBidInfo.curBidId,
          prePareBidInfo.bidId,
          curBidRemain
        );

      const currentBid = await auction.curBid(hNFT.address, 1);
      expect(currentBid.bidId).to.equal(prePareBidInfo.bidId);
      expect(currentBid.amount).to.equal(bidAmount);
      expect(currentBid.bidder).to.equal(bidder1.address);

      const preBidAmountRefund = await ad3Token.balanceOf(bidder1.address);
      expect(preBidAmountRefund).to.equal(90);

      const auctionTokenBalance = await governanceToken.balanceOf(
        auction.address
      );
      const allowanceBalanceAfter = await governanceToken.allowance(
        auction.address,
        relayer.address
      );

      expect(auctionTokenBalance).to.equal(
        BigNumber.from(bidAmount - curBidRemain).add(allowanceBalanceBefore)
      );
      expect(allowanceBalanceAfter).to.equal(
        BigNumber.from(bidAmount - curBidRemain).add(allowanceBalanceBefore)
      );
    });

    it("should allow users to commitBid without governance token", async () => {
      const hNFTId = 1;
      const bidAmount = 10;
      const preBidAmount = 10;
      await ad3Token
        .connect(bidder1)
        .approve(auction.address, preBidAmount + bidAmount);

      const transaction = await auction
        .connect(bidder1)
        .preBid(hNFT.address, hNFTId);
      const receipt = await transaction.wait();
      const event = receipt.events?.find((e) => e.event === "BidPrepared");
      const [curBidId, preBidId] = [
        event!.args!.curBidId,
        event!.args!.preBidId,
      ];

      const messageHash = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [1, hNFT.address, ad3Token.address, bidAmount, curBidId, preBidId]
      );

      const signature = await relayer.signMessage(
        ethers.utils.arrayify(messageHash)
      );

      const curBidRemain = 0;
      const allowanceBalanceBefore = await ad3Token.allowance(
        auction.address,
        relayer.address
      );

      await auction
        .connect(bidder1)
        .commitBid(
          { hNFTId: hNFTId, hNFTContractAddr: hNFT.address },
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
      expect(preBidAmountRefund).to.equal(90);

      const auctionTokenBalance = await ad3Token.balanceOf(auction.address);
      const allowanceBalanceAfter = await ad3Token.allowance(
        auction.address,
        relayer.address
      );

      expect(auctionTokenBalance).to.equal(
        BigNumber.from(bidAmount - curBidRemain).add(allowanceBalanceBefore)
      );
      expect(allowanceBalanceAfter).to.equal(
        BigNumber.from(bidAmount - curBidRemain).add(allowanceBalanceBefore)
      );
    });

    it("should refund the previous bidder when a new bid is submitted", async () => {
     
      const governanceTokenAddr = await governance.getGovernanceToken(hNFT.address, 1);

      if (governanceTokenAddr == ethers.constants.AddressZero) {
        governanceToken = ad3Token
      } else {
        governanceToken = await ethers.getContractAt("HNFTGovernanceToken", governanceTokenAddr, owner);
      }

      const preBidAmount1 = 10;
      const bidAmount1 = 60;
      const preBidAmount2 = 10;
      const bidAmount2 = 110;
      const hNFTId = 1;
      await ad3Token.connect(bidder1).approve(auction.address, preBidAmount1);

      const transaction1 = await auction
        .connect(bidder1)
        .preBid(hNFT.address, hNFTId);
      const receipt1 = await transaction1.wait();
      const event1 = receipt1.events?.find((e) => e.event === "BidPrepared");
      const [curBidId1, preBidId1] = [
        event1!.args!.curBidId,
        event1!.args!.preBidId,
      ];

      await governanceToken
        .connect(bidder1)
        .approve(auction.address, bidAmount1);
      const messageHash1 = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [
          1,
          hNFT.address,
          governanceToken.address,
          bidAmount1,
          curBidId1,
          preBidId1,
        ]
      );

      const signature1 = await relayer.signMessage(
        ethers.utils.arrayify(messageHash1)
      );

      await auction
        .connect(bidder1)
        .commitBid(
          { hNFTId: hNFTId, hNFTContractAddr: hNFT.address },
          bidAmount1,
          "slot-uri",
          signature1,
          curBidId1,
          preBidId1,
          0
        );

      const approveAmount = await governanceToken.allowance(
        auction.address,
        relayer.address
      );
      expect(approveAmount).to.equal(bidAmount1);

      const currentBid1 = await auction.curBid(hNFT.address, 1);
      expect(currentBid1.bidId).to.equal(preBidId1);
      expect(currentBid1.amount).to.equal(bidAmount1);
      expect(currentBid1.bidder).to.equal(bidder1.address);

      await ad3Token.connect(bidder2).approve(auction.address, preBidAmount2);

      const transaction2 = await auction
        .connect(bidder2)
        .preBid(hNFT.address, hNFTId);
      const receipt2 = await transaction2.wait();
      const event2 = receipt2.events?.find((e) => e.event === "BidPrepared");
      const [curBidId2, preBidId2] = [
        event2!.args!.curBidId,
        event2!.args!.preBidId,
      ];

      await governanceToken
        .connect(bidder2)
        .approve(auction.address, bidAmount2);
      const messageHash2 = ethers.utils.solidityKeccak256(
        ["uint256", "address", "address", "uint256", "uint256", "uint256"],
        [
          1,
          hNFT.address,
          governanceToken.address,
          bidAmount2,
          curBidId2,
          preBidId2,
        ]
      );
      const signature2 = await relayer.signMessage(
        ethers.utils.arrayify(messageHash2)
      );

      
      const curBidRemain = 20;
      // payout 20
      await governanceToken
        .connect(relayer)
        .transferFrom(auction.address, bidder3.address, 20);
      const allowanceBalanceBefore = await governanceToken.allowance(
        auction.address,
        relayer.address
      );

      await auction
        .connect(bidder2)
        .commitBid(
          { hNFTId: hNFTId, hNFTContractAddr: hNFT.address },
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
      const bidder1TokenBalance = await governanceToken.balanceOf(
        bidder1.address
      );
      expect(bidder1Balance).to.equal(60);
      expect(bidder1TokenBalance).to.equal(60);

      const bidder2Balance = await ad3Token.balanceOf(bidder2.address);
      const bidder2TokenBalance = await governanceToken.balanceOf(
        bidder2.address
      );
      expect(bidder2Balance).to.be.equal(10);
      expect(bidder2TokenBalance).to.be.equal(10);

      const auctionTokenBalance = await governanceToken.balanceOf(
        auction.address
      );
      const allowanceBalanceAfter = await governanceToken.allowance(
        auction.address,
        relayer.address
      );

      expect(auctionTokenBalance).to.equal(
        BigNumber.from(bidAmount2 - curBidRemain).add(allowanceBalanceBefore)
      );
      expect(allowanceBalanceAfter).to.equal(
        BigNumber.from(bidAmount2 - curBidRemain).add(allowanceBalanceBefore)
      );
    });
  });

  describe("relayer address management", () => {
    it("should allow the owner to get the relayer address", async () => {
      const getRelayerAddress = await auction
        .connect(owner)
        .getRelayerAddress();
      expect(getRelayerAddress).to.equal(relayer.address);
    });

    it("should allow the owner to update the relayer address", async () => {
      const newRelayer = owner;
      await auction.connect(owner).setRelayerAddress(newRelayer.address);
      const updatedRelayerAddress = await auction
        .connect(owner)
        .getRelayerAddress();
      expect(updatedRelayerAddress).to.equal(newRelayer.address);
    });

    it("should fail to set relayer address if not called by the owner", async () => {
      await expect(
        auction.connect(bidder1).setRelayerAddress(bidder2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("hnftGover address management", () => {
    it("should allow the owner to get the hnftGover address", async () => {
      const getHNFTGoverAddress = await auction
        .connect(owner)
        .getHNFTGoverAddress();
      expect(getHNFTGoverAddress).to.equal(governance.address);
    });

    it("should allow the owner to update the hnftGover address", async () => {
      const newHNFTGover = owner;
      await auction.connect(owner).setHNFTGoverAddress(newHNFTGover.address);
      const updatedHNFTGoverAddress = await auction
        .connect(owner)
        .getHNFTGoverAddress();
      expect(updatedHNFTGoverAddress).to.equal(newHNFTGover.address);
    });

    it("should fail to set hnftGover address if not called by the owner", async () => {
      await expect(
        auction.connect(bidder1).setHNFTGoverAddress(bidder2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("min deposit management", () => {
    it("should set the min deposit for pre-bid correctly", async () => {
      await auction.connect(owner).setMinDepositForPreBid(20);

      const newMinDeposit = await auction.getMinDepositForPreBid();
      expect(newMinDeposit).to.equal(20);
    });

    it("should fail to set the min deposit for pre-bid if not called by the owner", async () => {
      await expect(
        auction.connect(bidder1).setMinDepositForPreBid(20)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should return the correct min deposit for pre-bid", async () => {
      const returnedMinDeposit = await auction
        .connect(owner)
        .getMinDepositForPreBid();

      expect(returnedMinDeposit).to.equal(10);
    });

    it("should set new owner", async () => {
      const minDepositBalanceBefore = await auction
        .connect(owner)
        .getMinDepositForPreBid();
      await auction.connect(owner).transferOwnership(bidder1.address);

      await expect(auction.connect(bidder1).setMinDepositForPreBid(20));
      const minDepositBalanceAfter = await auction
        .connect(bidder1)
        .getMinDepositForPreBid();
      expect(minDepositBalanceAfter).to.equal(
        BigNumber.from(minDepositBalanceBefore).add(10)
      );
    });
  });

  describe("withdraw governance token", () => {
    it("should allow user to withdraw ad3 token", async () => {
      const withdrawAmount = 10;
      const nouce = 1;

      await ad3Token.transfer(auction.address, withdrawAmount);

      const messageHash = ethers.utils.solidityKeccak256(
        ["address", "address", "uint256", "uint256"],
        [ad3Token.address, bidder1.address, withdrawAmount, nouce]
      );

      const signature = await relayer.signMessage(
        ethers.utils.arrayify(messageHash)
      );

      await auction.connect(bidder1).withdrawGovernanceToken(ad3Token.address, bidder1.address, withdrawAmount, nouce, signature);
    });

    it("should allow user to withdraw governance token", async () => {
      governance.issueGovernanceToken(hNFT.address, 1, "Mock GT", "MGT");
      const governanceTokenAddr = await governance.getGovernanceToken(hNFT.address, 1);
      governanceToken = await ethers.getContractAt("HNFTGovernanceToken", governanceTokenAddr, owner);
 
      const withdrawAmount = 10;
      const nouce = 1;

      governanceToken.connect(owner).transfer(auction.address, withdrawAmount);

      const messageHash = ethers.utils.solidityKeccak256(
        ["address", "address", "uint256", "uint256"],
        [governanceToken.address, bidder1.address, withdrawAmount, nouce]
      );

      const signature = await relayer.signMessage(
        ethers.utils.arrayify(messageHash)
      );

      await auction.connect(bidder1).withdrawGovernanceToken(governanceToken.address, bidder1.address, withdrawAmount, nouce, signature);
    });
  });
});

export interface PrepareBidInfo {
  bidId: BigNumber;
  amount: BigNumber;
  bidder: string;
  preBidTime: BigNumber;
  governanceTokenAddr: string;
  curBidId: BigNumber;
}
