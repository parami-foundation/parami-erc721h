import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ERC20, ERC721, MockAD3, MockNFT, ParamiRegistry } from "../typechain"
import { expect } from "chai";

describe("ParamiRegistry", () => {
  let paramiRegistry: ParamiRegistry;
  let nftContract: MockNFT;
  let ad3Contract: MockAD3;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();

    const nftContractFactory = await ethers.getContractFactory("MockNFT");
    const ad3ContractFactory = await ethers.getContractFactory("MockAD3");
    const paramiRegistryFactory = await ethers.getContractFactory("ParamiRegistry");

    nftContract = await nftContractFactory.deploy();
    ad3Contract = await ad3ContractFactory.deploy();

    paramiRegistry = await upgrades.deployProxy(paramiRegistryFactory, [ad3Contract.address]) as ParamiRegistry;
    await paramiRegistry.deployed();
  });

  describe("Register and unregister", async () => {
    it("nft owner can register", async () => {
      await nftContract.connect(addr1).mint(1);
      await paramiRegistry.connect(addr1).register(nftContract.address, 1);
      expect(await paramiRegistry.isRegistered(nftContract.address, 1)).to.equal(true);
    });

    it("cannot register twice", async () => {
      await nftContract.mint(1);
      paramiRegistry.register(nftContract.address, 1);
      await expect(paramiRegistry.register(nftContract.address, 1)).to.be.revertedWith("AlreadyRegistered");
    });

    it("only nft's onwer can register", async () => {
      await nftContract.connect(addr1).mint(1);
      await expect(paramiRegistry.connect(addr2).register(nftContract.address, 1)).to.be.revertedWith("NotOwner");
    });

    it("can unregister", async () => {
      await nftContract.connect(addr1).mint(1);
      await paramiRegistry.connect(addr1).register(nftContract.address, 1);
      expect(await paramiRegistry.isRegistered(nftContract.address, 1)).to.equal(true);
      await paramiRegistry.connect(addr1).unregister(nftContract.address, 1);
      expect(await paramiRegistry.isRegistered(nftContract.address, 1)).to.equal(false);
    });

    it("can only unregister a registered nft", async () => {
      await nftContract.mint(1);
      await nftContract.mint(2);
      await paramiRegistry.register(nftContract.address, 1);
      await expect(paramiRegistry.unregister(nftContract.address, 2)).to.be.revertedWith("NotRegistered");
    });

    it("only owner can unregister", async () => {
      await nftContract.mint(1);
      await paramiRegistry.register(nftContract.address, 1);
      await expect(paramiRegistry.connect(addr2).unregister(nftContract.address, 1)).to.be.revertedWith("NotOwner");
    })
  })

  describe("Bid", async () => {
    it("has init outBidPricePercentage", async () => {
      expect(await paramiRegistry.getOutBidPricePercentage()).to.equal(20);
    })

    it("owner can change outBidPricePercentage", async () => {
      await paramiRegistry.setOutBidPricePercentage(30);
      expect(await paramiRegistry.getOutBidPricePercentage()).to.equal(30);
    })

    it("only owner can change outBidPricePercentage", async () => {
      await expect(paramiRegistry.connect(addr1).setOutBidPricePercentage(30)).to.be.revertedWith("Ownable: caller is not the owner");
      expect(await paramiRegistry.getOutBidPricePercentage()).to.equal(20);
    })

    beforeEach(async () => {
      await nftContract.mint(1);
      await ad3Contract.mint(100);
    })

    it("cannot bid unregistered nft", async () => {
      await ad3Contract.approve(paramiRegistry.address, 100);
      await expect(paramiRegistry.bid(nftContract.address, 1, nftContract.address, 2, 100)).to.be.revertedWith("NotRegistered");
    });

    it("must approve sufficient amount", async () => {
      await nftContract.mint(2);
      await ad3Contract.approve(paramiRegistry.address, 50);
      await paramiRegistry.register(nftContract.address, 1);
      await expect(paramiRegistry.bid(nftContract.address, 1, nftContract.address, 2, 100)).to.be.revertedWith("Insufficient allowance");
    })

    it("can bid", async () => {
      await nftContract.mint(2);
      await ad3Contract.approve(paramiRegistry.address, 100);
      await paramiRegistry.register(nftContract.address, 1);
      await paramiRegistry.bid(nftContract.address, 1, nftContract.address, 2, 100);
      const ad = await paramiRegistry.getAd(nftContract.address, 1);
      expect(ad.hnftAddress).is.equal(nftContract.address);
      expect(ad.tokenId).is.equal(2);
      expect(ad.price).is.equal(100);
    })

    it("cannot bid with low price", async () => {
      await nftContract.mint(2);
      await ad3Contract.approve(paramiRegistry.address, 100);
      await paramiRegistry.register(nftContract.address, 1);
      await paramiRegistry.bid(nftContract.address, 1, nftContract.address, 2, 100);

      await ad3Contract.connect(addr1).mint(100);
      await ad3Contract.connect(addr1).approve(paramiRegistry.address, 100);
      await expect(paramiRegistry.connect(addr1).bid(nftContract.address, 1, nftContract.address, 2, 100)).to.be.revertedWith("LowPrice");
    })

    it("can out bid", async () => {
      await nftContract.mint(2);
      await ad3Contract.approve(paramiRegistry.address, 100);
      await paramiRegistry.register(nftContract.address, 1);
      await paramiRegistry.bid(nftContract.address, 1, nftContract.address, 2, 100);

      await ad3Contract.connect(addr1).mint(150);
      await ad3Contract.connect(addr1).approve(paramiRegistry.address, 150);
      await paramiRegistry.connect(addr1).bid(nftContract.address, 1, nftContract.address, 2, 120);
      const ad = await paramiRegistry.getAd(nftContract.address, 1);
      expect(ad.price).to.equal(120);
    })
  })
})