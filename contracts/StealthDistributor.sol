// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StealthDistributor {
    address public immutable registry;
    address public immutable paystubStore;

    event Paid(
        string indexed runId,
        uint256 indexed lineIndex,
        bytes32 indexed destCommitment,
        bytes amountCipher,
        bytes4 viewTag
    );

    error NotRegistry();
    error ZeroAddress();

    constructor(address _registry, address _paystubStore) {
        if (_registry == address(0) || _paystubStore == address(0)) revert ZeroAddress();
        registry = _registry;
        paystubStore = _paystubStore;
    }

    function emitPaid(
        string calldata runId,
        uint256 lineIndex,
        bytes32 destCommitment,
        bytes calldata amountCipher,
        bytes4 viewTag
    ) external {
        if (msg.sender != registry) revert NotRegistry();

        emit Paid(runId, lineIndex, destCommitment, amountCipher, viewTag);
    }
}
