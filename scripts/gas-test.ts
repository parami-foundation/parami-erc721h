import { ethers } from "hardhat";
// import currency from "currency.js"

// const gasPrice = ethers.parseUnits("60", "gwei")
// const etherPrice = currency(2600)

// Assuming you have an async function where you deploy the contract
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Assuming `YourContract` is the contract you want to deploy
  const YourContract = await ethers.getContractFactory("AIMeFactory");
  const yourContract = await YourContract.deploy(); // Add constructor arguments if any

  await yourContract.deployed();

  console.log("YourContract deployed to:", yourContract.address);

  // Get the transaction receipt
  const transactionReceipt = await ethers.provider.getTransactionReceipt(yourContract.deployTransaction.hash);

  console.log("Gas used for deployment:", transactionReceipt.gasUsed.toString());
  const gasPrice = 130; // gwei
  const gasCost = gasPrice * Number(transactionReceipt.gasUsed);
  const gasCostInEth = ethers.utils.formatUnits(gasCost.toString(), 'gwei');
  console.log("Gas cost for deployment:", gasCostInEth, "ETH");
}

main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});