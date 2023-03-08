import { expect } from "chai";
import { ethers } from "hardhat";
import { CCTPBridge, AD3, MockLssController} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("CCTPBridge", function () {
  let bridgeContract: CCTPBridge;
  let ad3Contract: AD3;
  let lssControllerContract: MockLssController;
  let deployer: SignerWithAddress;

  beforeEach(async () => {
    [deployer] = await ethers.getSigners();

    const controllerFactroy = await ethers.getContractFactory("MockLssController");
    lssControllerContract = (await controllerFactroy.deploy()) as MockLssController;

    const ad3Factory = await ethers.getContractFactory("AD3");
    ad3Contract = (await ad3Factory.deploy(10000, "AD3", "AD3", deployer.address, deployer.address, 10000, lssControllerContract.address)) as AD3;

    const bridgeFactory = await ethers.getContractFactory("CCTPBridge");
    bridgeContract = await bridgeFactory.deploy(ad3Contract.address);
  });

  it("Should Deposit Ad3", async function () {
    await ad3Contract.approve(bridgeContract.address, 100);

    await expect(bridgeContract.depositForBurn(100)).to.emit(bridgeContract, "Deposited").withArgs(deployer.address, 100);
  });
});
