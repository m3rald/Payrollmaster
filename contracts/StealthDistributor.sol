// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StealthDistributor {
    address public registry;
    address public paystubStore;

    event Paid(
        string indexed runId,
        uint256 indexed lineIndex,
        bytes32 indexed destCommitment,
        bytes amountCipher,
        bytes4 viewTag
    );

    error NotRegistry();

    constructor(address _registry, address _paystubStore) {
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
