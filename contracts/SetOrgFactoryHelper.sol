// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRunRegistry {
    function setOrgFactory(address _orgFactory) external;
}

/// @notice One-shot helper: calls RunRegistry.setOrgFactory in its constructor,
///         then self-destructs. The constructor runs as msg.sender = deployer wallet,
///         which is exactly what RunRegistry.setOrgFactory requires.
contract SetOrgFactoryHelper {
    constructor(address runRegistry, address orgFactory) {
        IRunRegistry(runRegistry).setOrgFactory(orgFactory);
    }
}
