import { ethers } from "hardhat";
import { AIMePower, Permit2Clone, Permit2Vault } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumberish } from "ethers";
import {
  PERMIT2_ADDRESS,
  SignatureTransfer,
  PermitTransferFrom,
} from "@uniswap/Permit2-sdk";
const { expect } = require("chai");

const Permit2OnArbSepolia = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

const generateSignature = async (
  permit2address: string,
  signer: SignerWithAddress,
  spenderAddress: string,
  tokenAddress: string,
  amount: BigNumberish,
  nonce: string,
  deadline: number,
  chainId: number
) => {
  const permitTransferFrom: PermitTransferFrom = {
    permitted: {
      token: tokenAddress,
      amount: amount,
    },
    spender: spenderAddress,
    nonce: nonce,
    deadline: deadline,
  };

  const { domain, types, values } = SignatureTransfer.getPermitData(
    permitTransferFrom,
    // PERMIT2_ADDRESS,
    permit2address,
    chainId
  );
  const signature = await signer._signTypedData(domain, types, values);
  return signature;
};

describe("Permit2", () => {
  let owner: SignerWithAddress;
  let signer2: SignerWithAddress;
  let signer3: SignerWithAddress;
  let permit2CloneContract: Permit2Clone;
  let permit2VaultContract: Permit2Vault;
  let aimePowerContract: AIMePower;

  beforeEach("init", async () => {
    [owner, signer2, signer3] = await ethers.getSigners();

    const permit2CloneContractFactory = await ethers.getContractFactory(
      "Permit2Clone"
    );
    permit2CloneContract = await permit2CloneContractFactory.deploy();
    await permit2CloneContract.deployed();

    const permit2VaultContractFactory = await ethers.getContractFactory(
      "Permit2Vault"
    );
    permit2VaultContract = await permit2VaultContractFactory.deploy(
      permit2CloneContract.address
    );
    await permit2VaultContract.deployed();

    const aimePowerContractFactory = await ethers.getContractFactory(
      "AIMePower"
    );
    aimePowerContract = await aimePowerContractFactory.deploy("aime", "aime");
    await aimePowerContract.deployed();

    console.log("permit clone contract address", permit2CloneContract.address);
    console.log("permit2VaultContract address", permit2VaultContract.address);
  });

  describe("Transfer token with permit", () => {
    beforeEach("mint tokens", async () => {
      const amount = ethers.utils.parseEther("100");
      const tx1 = await aimePowerContract
        .connect(owner)
        .mint(signer2.address, amount);
      await tx1.wait();

      const signer2Balance = await aimePowerContract.balanceOf(signer2.address);
      expect(signer2Balance).to.equal(amount);
    });

    it("can deposit with permit", async () => {
      // need to approve first
      const maxAmount = ethers.constants.MaxUint256;
      const txApprove = await aimePowerContract
        .connect(signer2)
        .approve(permit2CloneContract.address, maxAmount);
      await txApprove.wait();

      const tokenAmount = ethers.utils.parseEther("10");
      const nonce = "1";
      const blockTimestamp = (await ethers.provider.getBlock("latest"))
        .timestamp;
      const deadline = blockTimestamp + 3600;
      const sig = await generateSignature(
        permit2CloneContract.address,
        signer2,
        permit2VaultContract.address,
        aimePowerContract.address,
        tokenAmount,
        nonce,
        deadline,
        31337
      );

      const tx1 = await permit2VaultContract
        .connect(signer2)
        .depositERC20(
          aimePowerContract.address,
          tokenAmount,
          nonce,
          deadline,
          sig
        );
      await tx1.wait();

      const vaultBalance = await permit2VaultContract.tokenBalancesByUser(
        signer2.address,
        aimePowerContract.address
      );
      expect(vaultBalance).to.equal(tokenAmount);
    });
  });
});
