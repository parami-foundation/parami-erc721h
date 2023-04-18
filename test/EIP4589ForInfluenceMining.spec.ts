import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { use, expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, Signer } from "ethers";
import { ethers, upgrades } from "hardhat";
import { deployAd3 } from "../scripts/influencemining/deployAD3";
import { AD3, EIP5489ForInfluenceMining } from "../typechain";
use(chaiAsPromised);

let imContract: EIP5489ForInfluenceMining;
let owner: SignerWithAddress;
let signer2: SignerWithAddress;
let tokenId: BigNumber;
let ad3Contract: AD3;

describe("UpgradeLevel", function () {
  beforeEach(async () => {
    await _beforeEach();
  });

  it("Should upgradeLevel from level zero to higher", async function () {
    //prepare
    let tokenId = 1;
    let targetLevel = 2;
    await prepareContext(owner, { tokenId, fromLevel: 0, mintToken: true });

    //prepare before action stat for verify
    let before = await getStatToCompare(owner, tokenId);

    //action
    await ad3Contract
      .connect(owner)
      .approve(imContract.address, 2n * 10n ** 18n);
    await imContract.connect(owner).upgradeTo(tokenId, targetLevel);

    //prepare after action for verify
    let after = await getStatToCompare(owner, tokenId);
    //verify
    expect(after.level).to.be.eq(targetLevel);
    expect(after.userBalance).to.be.eq(before.userBalance.sub(2n * 10n ** 18n));
  });

  it("should upgradeLevel from non-zero low to high", async () => {
    //prepare
    let tokenId = 1;
    let fromLevel = 1;
    let targetLevel = 2;
    await prepareContext(owner, { tokenId, fromLevel, mintToken: true });

    //prepare before action stat for verify
    const before = await getStatToCompare(owner, tokenId);

    //action
    await ad3Contract
      .connect(owner)
      .approve(imContract.address, 2n * 10n ** 18n);

    await imContract.connect(owner).upgradeTo(tokenId, targetLevel);

    //prepare after action for verify
    const after = await getStatToCompare(owner, tokenId);

    //verify
    expect(after.level).to.be.eq(targetLevel);
    expect(after.userBalance).to.be.eq(
      before.userBalance.sub(after.levelPrice.sub(before.levelPrice))
    );
  });

  it("should not upgradeLevel from high to low", async () => {
    //prepare
    let tokenId = 1;
    let fromLevel = 3;
    let targetLevel = 1;
    await prepareContext(owner, { tokenId, fromLevel, mintToken: true });

    //action
    let res = imContract.connect(owner).upgradeTo(tokenId, targetLevel);

    //verify
    await expect(res).to.be.rejected.then((e) => {
      console.log(e.message);
      expect(e.message).contains("targetLevel should G.T. fromLevel");
    });
  });

  it("should not upgradeLevel from to the same level", async () => {
    //prepare
    let tokenId = 1;
    let fromLevel = 3;
    let targetLevel = 3;
    await prepareContext(owner, { tokenId, fromLevel, mintToken: true });

    //action
    let res = imContract.connect(owner).upgradeTo(tokenId, targetLevel);

    //verify
    await expect(res).to.be.rejected.then((e) => {
      console.log(e.message);
      expect(e.message).contains("targetLevel should G.T. fromLevel");
    });
  });

  it("Should not upgradeLevel when level not exists", async () => {
    //prepare
    let tokenId = 1;
    let targetLevel = 4;
    await prepareContext(owner, { tokenId, fromLevel: 2, mintToken: true });

    //action
    let res = imContract.connect(owner).upgradeTo(tokenId, targetLevel);

    //verify
    await expect(res).to.be.rejected.then((e) => {
      console.log(e.message);
      expect(e.message).contains("targetLevel should exist");
    });
  });

  it("Should not upgradeLevel when ad3 balance is not enough", async () => {
    //prepare
    let tokenId = 1;
    let targetLevel = 2;
    await prepareContext(signer2, { tokenId, fromLevel: 0, mintToken: true });

    //action
    await expect(
      imContract.connect(signer2).upgradeTo(tokenId, targetLevel)
    ).to.be.rejected.then((e) => {
      console.log(e.message);
      expect(e.message as string).contains("should have enough ad3");
    });
  });

  it("Should not upgradeLevel when token not exists", async () => {
    await imContract
      .connect(owner)
      .manageLevelPrices(
        [1, 2, 3],
        [1n * 10n ** 18n, 2n * 10n ** 18n, 3n * 10n ** 18n]
      );
    console.log("finish manageLevelPrices");
    await ad3Contract
      .connect(owner)
      .approve(imContract.address, 20n * 10n ** 18n);
    console.log("finish approve");

    let res = imContract.upgradeTo(1, 3);
    await expect(res).to.be.rejected.then((e) => {
      console.log(e.message);
      expect(e.message).contains("ERC721: invalid token ID");
    });
  });
  it("Should not upgradeLevel when approve ad3 is not enough", async () => {});
});

describe("mint", function () {
  beforeEach(async () => {
    await _beforeEach();
  });
  it("Should success when targetLevel is 0", async () => {
    //prepare
    await prepareContext(owner, { fromLevel: 0 });

    //action
    const before = await getStatToCompare(owner, 0);
    await imContract.connect(owner).mint("http://123", 0);
    const after = await getStatToCompare(owner, 1);

    //verify
    //1.user's ad3 balance not changed
    expect(after.userBalance).to.be.eq(before.userBalance);
    //2.contract's ad3 balance not changed
    expect(after.contractBalance).to.be.eq(before.contractBalance);
  });
  it("Should success when targetLevel G.T. 0 and targetLevel exists", async () => {
    //prepare
    const targetLevel = 2;
    await prepareContext(owner, { fromLevel: 0 });
    //action
    const before = await getStatToCompare(owner, 0);
    await imContract.connect(owner).mint("http://123", targetLevel);
    const after = await getStatToCompare(owner, 1);
    //verify
    //1.ad3 balance changed as expected
    expect(after.userBalance).to.be.eq(before.userBalance.sub(after.levelPrice));
    //2.contract's ad3 balance changed as expected
    expect(after.contractBalance).to.be.eq(before.contractBalance.add(after.levelPrice));
    //3.token's level eq to targetLevel
    expect(after.level).to.be.eq(targetLevel);
  });
  it("Should fail when targetLevel L.T. 0", async () => {
    //prepare
    const targetLevel = -1;
    await prepareContext(owner, { fromLevel: 0 });
    //action
    const res = imContract.connect(owner).mint("http://123", targetLevel);
    await expect(res).to.be.rejected.then(e => {
      console.log(e.message);
      expect(e.message).contains("value out-of-bounds");
    });
  });
  it("Should fail when targetLevel doesn't exist", async () => {
    //prepare
    const targetLevel = 5;
    await prepareContext(owner, { fromLevel: 0 });
    //action
    const res = imContract.connect(owner).mint("http://123", targetLevel);
    await expect(res).to.be.rejected.then(e => {
      console.log(e.message);
      expect(e.message).contains("targetLevel should exist");
    }); 
  });
});

describe("withdrawAllAd3", () => {
  beforeEach(async () => {
    await _beforeEach();
  });

  it("should withdrawAllAd3", async () => {
    await ad3Contract.transfer(imContract.address, 20n * 10n ** 18n);

    //prepare stat before action for verify
    let contractBalanceBeforeWithdraw = await ad3Contract.balanceOf(
      imContract.address
    );
    let ownerBalanceBeforeWithdraw = await ad3Contract.balanceOf(owner.address);

    //action
    await imContract.withdrawAllAd3();

    //prepare stat after action for verify
    let contractBalanceAfterWithdraw = await ad3Contract.balanceOf(
      imContract.address
    );
    let ownerBalanceAfterWithdraw = await ad3Contract.balanceOf(owner.address);

    //verify
    expect(contractBalanceAfterWithdraw).to.be.eq(0n);
    expect(ownerBalanceAfterWithdraw).to.be.eq(
      ownerBalanceBeforeWithdraw.add(contractBalanceBeforeWithdraw)
    );
  });
});

interface Context {
  tokenId: number;
  fromLevel: number;
  mintToken: boolean;
}

const getStatToCompare = async (signer: SignerWithAddress, tokenId: number) => {
  const userBalance = await ad3Contract.balanceOf(signer.address);
  const level = await imContract.token2Level(tokenId);
  const levelPrice = await imContract.level2Price(level);
  const contractBalance = await ad3Contract.balanceOf(imContract.address);
  return { userBalance, level, levelPrice, contractBalance };
};

async function prepareContext(
  signer: SignerWithAddress,
  context?: Partial<Context>
) {
  const iconUri =
    "https://ipfs.parami.io/ipfs/QmWjFHRBL56GDsojZZNmzgq1oeYKqFnz7M28viVmDDz1xm";
  await imContract
    .connect(owner)
    .manageLevelPrices(
      [1, 2, 3],
      [1n * 10n ** 18n, 2n * 10n ** 18n, 3n * 10n ** 18n]
    );
  console.log("finish manageLevelPrices");
  await ad3Contract
    .connect(signer)
    .approve(imContract.address, 20n * 10n ** 18n);
  console.log("finish approve");
  if (!context) {
    console.log("finish prepareToken");
    return;
  }
  if (!!context.mintToken) {
    await imContract.connect(signer).mint(iconUri, 0);
    console.log("finish mint");
  }
  if (!!context.fromLevel) {
    console.log("fromLevel", context.fromLevel);
    await imContract
      .connect(signer)
      .upgradeTo(context!.tokenId!, context.fromLevel);
    console.log("finish upgradeTo");
  }
  console.log("finish prepareToken");
}

async function _beforeEach() {
  [owner, signer2] = await ethers.getSigners();
  ad3Contract = await deployAd3(owner.address);
  await ad3Contract.proposeLosslessTurnOff();
  await ad3Contract.executeLosslessTurnOff();

  const factory = await ethers.getContractFactory("EIP5489ForInfluenceMining");
  imContract = (await upgrades.deployProxy(factory, [
    ad3Contract.address,
  ])) as EIP5489ForInfluenceMining;
  await imContract.deployed();

  const balanceOfOwner = await ad3Contract.balanceOf(owner.address);
  console.log("balanceOfOwner is ", balanceOfOwner);
}
