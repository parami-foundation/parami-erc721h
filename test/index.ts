import { expect } from "chai";
import { ethers } from "hardhat";

describe("Contract Registry", function () {
  it("Should wrap successfully", async function () {
      const registryFactory = await ethers.getContractFactory("ERC721WRegistry")
      const registry = await registryFactory.deploy();
      await registry.deployed();

      const testingErc721ContractFactory = await ethers.getContractFactory("TestingERC721Contract");
      const erc721 = await testingErc721ContractFactory.deploy();
      await erc721.deployed();
      console.log("erc721 address", erc721.address);

      await registry.createERC721wContract(erc721.address);

      const getAddressOfWrapper = registry.getERC721wAddressFor(erc721.address);
      expect(await getAddressOfWrapper).to.equal("0xa16E02E87b7454126E5E10d957A927A7F5B5d2be");
  });

  it("Should wrap successfully", async function () {
  });
});
