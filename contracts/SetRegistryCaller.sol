// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IOrgFactory {
    function setRegistry(address _registry) external;
}

/// @notice One-shot deploy: calls OrgFactory.setRegistry in the constructor, then self-destructs.
contract SetRegistryCaller {
    constructor(address orgFactory, address registry) {
        IOrgFactory(orgFactory).setRegistry(registry);
    }
}
