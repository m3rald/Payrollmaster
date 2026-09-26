// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PaystubStore {
    struct Paystub {
        bytes32 destCommitment;
        bytes amountCipher;
        bytes4 viewTag;
    }

    mapping(string runId => mapping(uint256 lineIndex => Paystub)) public paystubs;

    /// @notice The only address authorised to write paystubs (set once at deploy).
    address public immutable registry;

    error NotRegistry();
    error AlreadyStored();

    event PaystubStored(string indexed runId, uint256 indexed lineIndex, bytes32 destCommitment, bytes4 viewTag);

    constructor(address _registry) {
        registry = _registry;
    }

    function store(
        string calldata runId,
        uint256 lineIndex,
        bytes32 destCommitment,
        bytes calldata amountCipher,
        bytes4 viewTag
    ) external {
        if (msg.sender != registry) revert NotRegistry();
        // Prevent overwrites — paystubs are immutable once written
        if (paystubs[runId][lineIndex].destCommitment != bytes32(0)) revert AlreadyStored();

        paystubs[runId][lineIndex] = Paystub({destCommitment: destCommitment, amountCipher: amountCipher, viewTag: viewTag});

        emit PaystubStored(runId, lineIndex, destCommitment, viewTag);
    }

    function getViewTag(string calldata runId, uint256 lineIndex) external view returns (bytes4) {
        return paystubs[runId][lineIndex].viewTag;
    }
}
