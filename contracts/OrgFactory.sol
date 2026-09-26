// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Vault} from "./Vault.sol";

contract OrgFactory {
    mapping(string orgId => address vault) public vaultOf;
    mapping(string orgId => address owner) public ownerOf;
    mapping(string orgId => address maker) public makerOf;
    mapping(string orgId => address checker) public checkerOf;

    address public immutable usdc;
    address public registry;
    address public immutable deployer;
    bool private registrySet;

    event OrgCreated(string indexed orgId, address owner, address vault);
    event MakerSet(string indexed orgId, address maker);
    event CheckerSet(string indexed orgId, address checker);

    error OrgAlreadyExists();
    error InvalidOwner();
    error OrgNotFound();
    error NotOrgOwner();

    error RegistryAlreadySet();
    error NotDeployer();
    error ZeroRegistry();

    constructor(address _usdc) {
        usdc = _usdc;
        deployer = msg.sender;
    }

    /// @notice One-time setter called by deployer after RunRegistry is deployed.
    function setRegistry(address _registry) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (registrySet) revert RegistryAlreadySet();
        if (_registry == address(0)) revert ZeroRegistry();
        registry = _registry;
        registrySet = true;
    }

    function createOrg(string calldata orgId, string calldata name, address owner) external returns (address vault) {
        name;

        if (owner == address(0)) revert InvalidOwner();
        if (vaultOf[orgId] != address(0)) revert OrgAlreadyExists();

        Vault deployedVault = new Vault(usdc, orgId, owner, registry);
        vault = address(deployedVault);

        vaultOf[orgId] = vault;
        ownerOf[orgId] = owner;

        emit OrgCreated(orgId, owner, vault);
    }

    function setMaker(string calldata orgId, address maker) external {
        address orgOwner = ownerOf[orgId];
        if (orgOwner == address(0)) revert OrgNotFound();
        if (msg.sender != orgOwner) revert NotOrgOwner();

        makerOf[orgId] = maker;
        emit MakerSet(orgId, maker);
    }

    function setChecker(string calldata orgId, address checker) external {
        address orgOwner = ownerOf[orgId];
        if (orgOwner == address(0)) revert OrgNotFound();
        if (msg.sender != orgOwner) revert NotOrgOwner();

        checkerOf[orgId] = checker;
        emit CheckerSet(orgId, checker);
    }
}
