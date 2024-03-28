// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AIMePowerV2 is ERC20, Ownable {
    event Received(address sender, uint amount);
    event Trade(
        address trader,
        bool isBuy,
        uint256 powerAmount,
        uint256 ethAmount
    );

    bool private init;

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) Ownable(msg.sender) {
        // mint 10k tokens to this contract
        _mint(address(this), 10000 * 1e18);
        // mint 990k tokens to owner(aime nft contract)
        _mint(msg.sender, 990000 * 1e18);
    }

    function transfer(address to, uint256 value) public virtual override returns (bool) {
        if (to == address(this)) {
            sellPowers(value);
        } else {
            address owner = _msgSender();
            _transfer(owner, to, value);
        }
        return true;
    }

    function getBuyPrice(uint256 amount) public view returns (uint256) {
        return (address(this).balance * amount) / (balanceOf(address(this)) - amount);
    }

    function getSellPrice(uint256 amount) public view returns (uint256) {
        return (address(this).balance * amount) / (balanceOf(address(this)) + amount);
    }

    function buyPowers() internal {
        uint256 token_amount = (balanceOf(address(this)) * msg.value) / (address(this).balance);
        // todo: add check?

        // transfer token to user
        _transfer(address(this), msg.sender, token_amount);
        emit Trade(msg.sender, true, token_amount, msg.value);
    }

    function sellPowers(
        uint256 token_amount
    ) internal {
        // eth amount
        uint256 ethAmount = getSellPrice(token_amount);
        require(ethAmount > 0, "Amount too small");
        require(address(this).balance >= ethAmount, "Insufficient ETH balance");

        // transfer token to this contract
        _transfer(msg.sender, address(this), token_amount);
        
        // transfer eth to user
        (bool success, ) = msg.sender.call{value: ethAmount}("");
        require(success, "Unable to send funds");

        emit Trade(msg.sender, false, token_amount, ethAmount);
    }

    receive() external payable {
        if (init) {
            buyPowers();
        } else {
            init = true;
        }
    }
}
