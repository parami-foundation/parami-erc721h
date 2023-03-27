import { expect } from "chai";
import { ethers } from "hardhat";
import { ParamiCCTP, AD3, MockLssController} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("CCTPBridge", function () {
  let bridgeContract: ParamiCCTP;
  let ad3Contract: AD3;
  let lssControllerContract: MockLssController;
  let deployer: SignerWithAddress;

  beforeEach(async () => {
    [deployer] = await ethers.getSigners();

    const controllerFactroy = await ethers.getContractFactory("MockLssController");
    lssControllerContract = (await controllerFactroy.deploy()) as MockLssController;

    const ad3Factory = await ethers.getContractFactory("AD3");
    ad3Contract = (await ad3Factory.deploy(10000, "AD3", "AD3", deployer.address, deployer.address, 10000, lssControllerContract.address)) as AD3;

    const paramiCCTP = await ethers.getContractFactory("ParamiCCTP");
    bridgeContract = await paramiCCTP.deploy(1);
  });

  it("Should Deposit Ad3", async function () {
    const assetId = 10000;
    await bridgeContract.registerAsset(assetId, ad3Contract.address);
    await ad3Contract.approve(bridgeContract.address, 100);

    const recepientBytes = ethers.utils.formatBytes32String("abdc");
    const domain = 1;

    await expect(bridgeContract.deposit(assetId, 100, 2, recepientBytes)).to.emit(bridgeContract, "Deposited").withArgs(1, assetId, 100, domain, deployer.address, 2, recepientBytes);
  });

  it("Should withdraw", async function () {
    const assetId = 10000;
    const sourceDomain = 2;
    const source = ethers.utils.formatBytes32String("abdc");
    const nonce = 1;
    const amount = 100;
    const destDomain = 1;
    const destAddr = deployer.address;

    await bridgeContract.registerAsset(assetId, ad3Contract.address);
    await ad3Contract.approve(bridgeContract.address, 100);
    await bridgeContract.deposit(assetId, amount, sourceDomain, source);

    const digest = generateMessageHash(nonce, sourceDomain, source, assetId, amount, destDomain, destAddr);

    const signatureStringsig = await deployer.signMessage(ethers.utils.arrayify(digest));
    console.log("", deployer.getAddress(), await bridgeContract.owner());

    await expect(bridgeContract.withdraw(nonce, assetId, amount, sourceDomain, source, destAddr, signatureStringsig)).to.emit(bridgeContract, "Withdrawed").withArgs(nonce, assetId, amount, sourceDomain, source, destDomain, destAddr);
  });

  it("Should fail to withdraw if withdrawed before", async function () {
    const assetId = 10000;
    const sourceDomain = 2;
    const source = ethers.utils.formatBytes32String("abdc");
    const nonce = 1;
    const amount = 100;
    const destDomain = 1;
    const destAddr = deployer.address;

    await bridgeContract.registerAsset(assetId, ad3Contract.address);
    await ad3Contract.approve(bridgeContract.address, 100);
    await bridgeContract.deposit(assetId, amount, sourceDomain, source);

    const digest = generateMessageHash(nonce, sourceDomain, source, assetId, amount, destDomain, destAddr);

    const signatureStringsig = await deployer.signMessage(ethers.utils.arrayify(digest));
    console.log("", deployer.getAddress(), await bridgeContract.owner());

    await bridgeContract.withdraw(nonce, assetId, amount, sourceDomain, source, destAddr, signatureStringsig);
    await expect(bridgeContract.withdraw(nonce, assetId, amount, sourceDomain, source, destAddr, signatureStringsig)).to.be.revertedWith("nonce already used");

  });

});

function generateMessageHash(nonce: number,
                     sourceDomain: number,
                     sender: string,
                     assetId: number,
                     amount: number,
                     destDomain: number,
                     destinationRecepient: string,
                     ): string {
    const messageBytes = ethers.utils.solidityPack(['uint256', 'uint256', 'uint256', 'uint256', 'bytes', 'uint256', 'address'], [nonce, assetId, amount, sourceDomain, sender, destDomain, destinationRecepient]);
    const messageDigest = ethers.utils.keccak256(messageBytes);
    return messageDigest;
}
