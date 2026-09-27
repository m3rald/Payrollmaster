// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Vault {
    using SafeERC20 for IERC20;

    address public immutable usdc;
    string public orgId;
    address public immutable owner;
    address public immutable registry;

    event Funded(uint256 amount, uint256 newBalance);
    event Pulled(address to, uint256 amount);
    event Withdrawn(address to, uint256 amount);

    error NotRegistry();
    error NotOwner();
    error InvalidRecipient();
    error ZeroAmount();
    error ZeroAddress();

    constructor(address _usdc, string memory _orgId, address _owner, address _registry) {
        if (_usdc == address(0) || _owner == address(0) || _registry == address(0)) revert ZeroAddress();
        usdc = _usdc;
        orgId = _orgId;
        owner = _owner;
        registry = _registry;
    }

    function fund(uint256 amount) external {
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(amount, IERC20(usdc).balanceOf(address(this)));
    }

    function pull(address to, uint256 amount) external {
        if (msg.sender != registry) revert NotRegistry();
        if (to == address(0)) revert InvalidRecipient();

        IERC20(usdc).safeTransfer(to, amount);
        emit Pulled(to, amount);
    }

    /// @notice Owner can withdraw any idle USDC from the vault.
    function withdraw(uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        if (amount == 0) revert ZeroAmount();
        IERC20(usdc).safeTransfer(owner, amount);
        emit Withdrawn(owner, amount);
    }

    function balance() external view returns (uint256) {
        return IERC20(usdc).balanceOf(address(this));
    }
}
