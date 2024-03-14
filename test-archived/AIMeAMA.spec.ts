import { ethers } from "hardhat";
import { AIMeAMA } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const { expect } = require("chai");

describe("AIMe AMA Contract", () => {
  // const _beforeEach = async () => {
  //   [owner, signer2] = await ethers.getSigners();

  //   const amaContractFactory = await ethers.getContractFactory("AIMeAMA");
  //   amaContract = await amaContractFactory.deploy();
  //   await amaContract.deployed();
  // };
  let amaContract: AIMeAMA;
  let owner: SignerWithAddress;
  let signer2: SignerWithAddress;

  beforeEach("init", async () => {
    console.log("initing");
    [owner, signer2] = await ethers.getSigners();

    const amaContractFactory = await ethers.getContractFactory("AIMeAMA");
    amaContract = await amaContractFactory.deploy();
    await amaContract.deployed();
  });

  describe("test 1", () => {
    it("ama contract deployed", () => {
      console.log("amaContract address", amaContract.address);
      console.log("owner", owner);
      console.log("signer2", signer2);
      expect(1).eq(1);
    });
  });
});
