import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { verify } from "crypto";
import { BigNumber, BigNumberish, Contract } from "ethers";
import { stat } from "fs";
import { ethers, upgrades } from "hardhat";
import { string } from "hardhat/internal/core/params/argumentTypes";
import { deployAd3 } from "../scripts/influencemining/deployAD3";
import { AD3, SignatureERC20Withdraw } from "../typechain";

let owner: SignerWithAddress;
let signer2: SignerWithAddress;
let ad3Contract: AD3;
let utContract: SignatureERC20Withdraw;
const chainIdInContract = 5;

describe("withdraw", () => {
  beforeEach("init", async () => {
    await _beforeEach();
  });

  it("should success", async () => {
    const params = {
      ...validParams(),
    };

    const context = newTestContext(params);

    await context.action();
    const { before, after } = await context.getBeforeAndAfter();
    //verify
    //1. userBalance increased as expected
    expect(after!.userBalance).to.be.eq(before!.userBalance.add(params.amount));
    //2. contractBalance decreased as expected
    expect(after!.contractBalance).to.be.eq(
      before!.contractBalance.sub(params.amount)
    );
  });

  it("should fail when signature not valid", async () => {
    const params: Params = {
      ...validParams(),
      validSig: false,
    };

    const testContext = await newTestContext(params);

    const res = testContext.action();
    //verify
    //3. error
    await expect(res).to.be.rejected.then((e) => {
      expect(e.message).contain("signature not valid");
    });
    testContext.expectStatNotChanged();
  });

  it("should fail when chainId not matched with contract", async () => {
    //prepare
    const params = {
      ...validParams(),
      chainId: chainIdInContract + 200,
    };
    const context = await newTestContext(params);
    //action
    let res = context.action();
    //verify

    //3. error
    await expect(res).to.be.rejected.then((e) => {
      expect(e.message).contains(
        "chainId in params should match the contract's chainId"
      );
    });
    context.expectStatNotChanged();
  });

  it("should fail when  contract balance not enough", async () => {
    //prepare
    const params = {
      ...validParams(),
      amount: ethers.utils.parseUnits("100", 18),
      contractInitBalance: ethers.utils.parseUnits("50", 18),
    } as Params;

    const context = newTestContext(params);
    //action
    const res = context.action();
    //verify
    //3. error
    await expect(res).to.be.rejected.then((e) => {
      console.log(e.message);
      expect(e.message).contains("LERC20: transfer amount exceeds balance");
    });

    context.expectStatNotChanged();
  });

  it("should fail when nounce used", async () => {
    await newTestContext(validParams()).action();

    const context = newTestContext({ ...validParams() });
    const res = context.action();

    await expect(res).to.be.rejected.then((e) => {
      expect(e.message).contains("nounce must not used");
    });

    context.expectStatNotChanged();
  });

  type Params = {
    attester: SignerWithAddress;
    to: string;
    chainId: BigNumberish;
    amount: BigNumberish;
    nounce: BigNumberish;
    validSig: boolean;
    contractInitBalance: BigNumberish;
  };

  const validParams = () => {
    return {
      attester: owner,
      to: "0x2C71b3E0B068C4d365AdD4035Dc7f8eB6dC6C910",
      chainId: chainIdInContract,
      amount: ethers.utils.parseUnits("100", 18),
      nounce: 121,
      // control behavior
      validSig: true,
      contractInitBalance: ethers.utils.parseUnits("10000", 18),
    };
  };

  type Stat = { userBalance: BigNumber; contractBalance: BigNumber };

  const newTestContext = (_params: Params) => {
    const genSig = async (
      attester: SignerWithAddress,
      to: string,
      chainId: BigNumberish,
      amount: BigNumberish,
      nounce: BigNumberish
    ) => {
      let message = ethers.utils.solidityPack(
        ["address", "uint256", "uint256", "uint256"],
        [to, chainId, amount, nounce]
      );
      message = ethers.utils.solidityKeccak256(["bytes"], [message]);
      const signature = await attester.signMessage(
        ethers.utils.arrayify(message)
      );
      return signature;
    };

    const getStat = async () => {
      const userBalance = await ad3Contract.balanceOf(_params.to);
      const contractBalance = await ad3Contract.balanceOf(utContract.address);
      return { userBalance, contractBalance };
    };

    let before: Stat | undefined = undefined;
    let after: Stat | undefined = undefined;

    return {
      params: _params,
      validParams: {} as Params,
      getBeforeAndAfter: () => {
        return { before, after };
      },
      action: async () => {
        await ad3Contract.transfer(
          utContract.address,
          _params.contractInitBalance
        );
        let sig = await genSig(
          _params.attester,
          _params.to,
          _params.chainId,
          _params.validSig
            ? _params.amount
            : BigNumber.from(_params.amount).add(20),
          _params.nounce
        );

        before = await getStat();
        try {
          await utContract.withdraw(
            _params.attester.address,
            _params.to,
            _params.chainId,
            _params.amount,
            _params.nounce,
            sig
          );
        } catch (e) {
          throw e;
        } finally {
          after = await getStat();
        }
      },
      expectStatNotChanged: () => {
        //1. userBalance not changed
        expect(after!.userBalance).to.be.eq(before!.userBalance);
        //2. contractBalance not changed
        expect(after!.contractBalance).to.be.eq(before!.contractBalance);
      },
    };
  };
});

const _beforeEach = async () => {
  [owner, signer2] = await ethers.getSigners();
  ad3Contract = await deployAd3(owner.address);
  await ad3Contract.proposeLosslessTurnOff();
  await ad3Contract.executeLosslessTurnOff();

  const factory = await ethers.getContractFactory("SignatureERC20Withdraw");
  utContract = (await upgrades.deployProxy(factory, [
    ad3Contract.address,
    chainIdInContract /**goerli */,
  ])) as SignatureERC20Withdraw;
  await utContract.deployed();
};
