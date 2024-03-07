// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AIMe404Power is ERC20, Ownable {

    // Event to log arbitrary call data
    event CallDataLogged(address indexed sender, bytes data);

    constructor() ERC20("KaiKang", "KK") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) public { // todo: only owner
        _mint(to, amount);
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `value`.
     */
    function transfer(address to, uint256 value) public virtual override returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, value);
        return true;
    }
    
    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `value`.
     */
    function transfer(address to, uint256 value, bytes calldata data) public virtual returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, value);
        emit CallDataLogged(msg.sender, data);
        return true;
    }
}
