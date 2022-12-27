import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import { ERC721HBatchCollection } from "../typechain";

describe("ERC721W", function () {
    let batchCollection: ERC721HBatchCollection;
    let owner: SignerWithAddress;
    let tokenId: BigNumber;

    beforeEach(async () => {
      const erc721HBatchCollection = await ethers.getContractFactory("ERC721HBatchCollection");
      batchCollection = await upgrades.deployProxy(erc721HBatchCollection, ["https://airdrop.parami.io/hnft/", "https://app.parami.io/hnft/ethereum/", 100000]) as ERC721HBatchCollection;
      await batchCollection.deployed();
      [owner] = await ethers.getSigners();
    })


    it("Should have correct metadata", async function () {
      expect(await batchCollection.getSlotUri(100, owner.address))
        .to.equal("https://app.parami.io/hnft/ethereum/" + batchCollection.address.toLocaleLowerCase() + "/" + 100);
    });


});
