import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { HyperlinkAsNft, MockAD3, MockNFT, ParamiRegistry } from "../typechain"
import { expect } from "chai";

describe("ParamiRegistry", () => {
  let paramiRegistry: ParamiRegistry;
  let nftContract: MockNFT;
  let ad3Contract: MockAD3;
  let hnftContract: HyperlinkAsNft;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();

    const nftContractFactory = await ethers.getContractFactory("MockNFT");
    const ad3ContractFactory = await ethers.getContractFactory("MockAD3");
    const paramiRegistryFactory = await ethers.getContractFactory("ParamiRegistry");
    const hnftFactory = await ethers.getContractFactory("HyperlinkAsNft");

    nftContract = await nftContractFactory.deploy();
    ad3Contract = await ad3ContractFactory.deploy();

    hnftContract = await upgrades.deployProxy(hnftFactory) as HyperlinkAsNft;
    await hnftContract.deployed();

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

    it("has init adDuration", async () => {
      expect(await paramiRegistry.getAdDuration()).to.equal(24 * 60 * 60);
    })

    it("contract owner and only owner can change adDuration", async () => {
      const twoHours = 2 * 60 * 60;
      await paramiRegistry.setAdDuration(twoHours);
      expect(await paramiRegistry.getAdDuration()).to.equal(twoHours);
      await expect(paramiRegistry.connect(addr1).setAdDuration(twoHours + 1)).to.be.revertedWith("Ownable: caller is not the owner");
      expect(await paramiRegistry.getAdDuration()).to.equal(twoHours);
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

    describe("bid and after first bid", async () => {
      beforeEach(async () => {
        await hnftContract.mint("", "", "");
        await ad3Contract.approve(paramiRegistry.address, 100);
        await paramiRegistry.register(nftContract.address, 1);
        await paramiRegistry.bid(nftContract.address, 1, hnftContract.address, 1, 100);
      })

      it("can bid", async () => {
        expect(await ad3Contract.balanceOf(owner.address)).to.equal(0);
        expect(await ad3Contract.balanceOf(paramiRegistry.address)).to.equal(100);
        const ad = await paramiRegistry.getAd(nftContract.address, 1);
        expect(ad.hnftAddress).is.equal(hnftContract.address);
        expect(ad.tokenId).is.equal(1);
        expect(ad.price).is.equal(100);
      })

      it("cannot bid with low price", async () => {
        await ad3Contract.connect(addr1).mint(100);
        await ad3Contract.connect(addr1).approve(paramiRegistry.address, 100);
        await expect(paramiRegistry.connect(addr1).bid(nftContract.address, 1, hnftContract.address, 1, 100)).to.be.revertedWith("LowPrice");
        expect(await ad3Contract.balanceOf(addr1.address)).to.equal(100);
      })

      it("can only bid with hnft", async () => {
        await ad3Contract.connect(addr1).mint(150);
        await ad3Contract.connect(addr1).approve(paramiRegistry.address, 150);
        await nftContract.connect(addr1).mint(2);
        await expect(paramiRegistry.connect(addr1).bid(nftContract.address, 1, nftContract.address, 2, 150)).to.be.revertedWith("NotHyperlinkNFT");
      })

      it("can out bid", async () => {
        await hnftContract.mint("", "", "");
        await ad3Contract.connect(addr1).mint(150);
        await ad3Contract.connect(addr1).approve(paramiRegistry.address, 150);
        await paramiRegistry.connect(addr1).bid(nftContract.address, 1, hnftContract.address, 2, 120);
        expect(await ad3Contract.balanceOf(addr1.address)).to.equal(30);
        expect(await ad3Contract.balanceOf(paramiRegistry.address)).to.equal(220);
        const ad = await paramiRegistry.getAd(nftContract.address, 1);
        expect(ad.hnftAddress).to.equal(hnftContract.address);
        expect(ad.tokenId).to.equal(2);
        expect(ad.price).to.equal(120);
      })

      it("delete ad after unregister", async () => {
        await paramiRegistry.unregister(nftContract.address, 1);
        const ad = await paramiRegistry.getAd(nftContract.address, 1);
        expect(ad.hnftAddress).is.equal(ethers.constants.AddressZero);
        expect(ad.tokenId).is.equal(0);
        expect(ad.price).is.equal(0);
      })

      it("can bid after ad expired", async () => {
        const oneDay = 24 * 60 * 60;
        await hnftContract.mint("", "", "");
        await ad3Contract.connect(addr1).mint(100);
        await ad3Contract.connect(addr1).approve(paramiRegistry.address, 50);
        await expect(paramiRegistry.connect(addr1).bid(nftContract.address, 1, hnftContract.address, 2, 50)).to.be.revertedWith("LowPrice");
        expect(await paramiRegistry.getAdDuration()).to.equal(oneDay);
        
        await ethers.provider.send('evm_increaseTime', [oneDay]);

        await paramiRegistry.connect(addr1).bid(nftContract.address, 1, hnftContract.address, 2, 50);
        expect(await ad3Contract.balanceOf(addr1.address)).to.equal(50);
        expect(await ad3Contract.balanceOf(paramiRegistry.address)).to.equal(150);
        const ad = await paramiRegistry.getAd(nftContract.address, 1);
        expect(ad.tokenId).to.equal(2);
        expect(ad.price).to.equal(50);
      })
    })
  })
})