// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRunRegistry {
    function setOrgFactory(address _orgFactory) external;
}

/// @notice One-shot helper: calls setOrgFactory on RunRegistry in the constructor,
///         then self-destructs. Deployed by the same wallet that deployed RunRegistry,
///         so msg.sender == deployer and the call succeeds.
contract SetFactoryCaller {
    constructor(address registry, address factory) {
        IRunRegistry(registry).setOrgFactory(factory);
    }
}
