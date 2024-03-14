import { ethers } from "hardhat";
import { AIMePowersV5 } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const { expect } = require("chai");

describe("AIMe Power V5 Contract", () => {
  let aimeContract: AIMePowersV5;
  let owner: SignerWithAddress;
  let signer2: SignerWithAddress;
  let signer3: SignerWithAddress;

  beforeEach("init", async () => {
    console.log("initializing...");
    [owner, signer2, signer3] = await ethers.getSigners();

    const aimeContractFactory = await ethers.getContractFactory("AIMePowersV5");
    aimeContract = await aimeContractFactory.deploy();
    await aimeContract.deployed();
  });

  describe("Contract deploy", () => {
    it("aime contract deployed", async () => {
      console.log("aimeContract address", aimeContract.address);
      const protocolFeePercent = await aimeContract.protocolFeePercent();
      const referrerFeePercent = await aimeContract.referrerFeePercent();
      const decimals = await aimeContract.DECIMALS();
      const creatorInitAmount = await aimeContract.CREATOR_INIT_AMOUNT();

      expect(protocolFeePercent).eq(5);
      expect(referrerFeePercent).eq(3);
      expect(decimals).eq(4);
      expect(creatorInitAmount).eq(10000);
    });
  });

  describe("setFeeDestination", () => {
    it("only owner can set fee destination", async () => {
      // const [owner, signer2] = await ethers.getSigners();
      const signer2Address = await signer2.getAddress();

      await expect(
        aimeContract.connect(signer2).setFeeDestination(signer2Address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await aimeContract.connect(owner).setFeeDestination(signer2Address);

      const feeDestination = await aimeContract.protocolFeeDestination();
      expect(feeDestination).to.be.equal(signer2Address);
    });
  });

  describe("setReferrer", () => {
    it("can set referrer", async () => {
      const ownerAddress = await owner.getAddress();
      const signer2Address = await signer2.getAddress();
      await aimeContract.connect(owner).setReferrer(signer2Address);
      const referrer = await aimeContract.referrer(ownerAddress);
      expect(referrer).to.be.equal(signer2Address);
    });

    it("cannot change referrer", async () => {
      const signer2Address = await signer2.getAddress();
      const signer3Address = await signer3.getAddress();

      await aimeContract.connect(owner).setReferrer(signer2Address);

      await expect(
        aimeContract.connect(owner).setReferrer(signer3Address)
      ).to.be.revertedWith("Cannot change referrer");
    })

    it("user cannot refer themselves", async () => {
      const ownerAddress = await owner.getAddress();

      await expect(
        aimeContract.connect(owner).setReferrer(ownerAddress)
      ).to.be.revertedWith("Cannot refer yourself");
    });
  });

  describe("Init AIME", () => {
    it("can init AIME", async () => {
      await aimeContract.connect(owner).initAIME();
      const ownerAddress = await owner.getAddress();
      const supply = await aimeContract.powersSupply(ownerAddress);
      const balance = await aimeContract.powerBalance(
        ownerAddress,
        ownerAddress
      );
      expect(supply).eq(10000);
      expect(balance).eq(10000);
    });

    it("cannot init AIME if already initialized", async () => {
      await aimeContract.connect(owner).initAIME();
      await expect(aimeContract.connect(owner).initAIME()).to.be.revertedWith(
        "Already initialized"
      );
    });
  });

  // todo: tests
  // feePercentage
  // - Test correct fee percentage is returned based on whether a referrer is set or not.
  // - getBuyPrice, getSellPrice, getBuyPriceAfterFee, getSellPriceAfterFee
  // - Test price calculations for various scenarios.
  describe("Fees and prices", () => {
    it("returns the right fee percentage", async () => {
      const signer2Address = await signer2.getAddress();
      await aimeContract.connect(owner).setReferrer(signer2Address);
      const ownerFeePercentage = await aimeContract
        .connect(owner)
        .feePercentage();
      const signer2FeePercentage = await aimeContract
        .connect(signer2)
        .feePercentage();
      expect(ownerFeePercentage).eq(3);
      expect(signer2FeePercentage).eq(5);
    });

    it("returns the right price", async () => {
      const zeroSupplyPirce = await aimeContract.getPrice(0, 1000);
      expect(zeroSupplyPirce).to.be.equal(0);

      const zeroAmountPrice = await aimeContract.getPrice(10000, 0);
      expect(zeroAmountPrice).to.be.equal(0);

      const firstFractionPowerPrice = await aimeContract.getPrice(10000, 1);
      expect(firstFractionPowerPrice).to.be.equal(208312);

      const firstPowerPirce = await aimeContract.getPrice(10000, 10000);
      expect(firstPowerPirce).to.be.equal(41666666666625);

      const secondPowerPirce = await aimeContract.getPrice(20000, 10000);
      expect(secondPowerPirce).to.be.equal(208333333333375);
    });
  });

  // todo: tests
  // buyPowers
  // - Test buying powers with correct and incorrect values.
  // - Check balances and supply updates accordingly.
  // - Validate event emission.

  // sellPowers
  // - Test selling powers with various amounts.
  // - Validate balances, supply, and pool adjustments.
  // - Ensure it fails if trying to sell more than owned.
  // - Check for successful ETH transfer and event emission.
});
