// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import {OrgFactory} from "./OrgFactory.sol";
import {Vault} from "./Vault.sol";

contract RunRegistry {
    using SafeERC20 for IERC20;

    struct Run {
        bytes32 rosterRoot;
        uint256 totalAmount;
        bool approved;
        bool executed;
        address checker;
        string orgId;
    }

    mapping(string runId => Run) public runs;
    mapping(string runId => mapping(uint256 lineIndex => bool)) public claimed;

    address public orgFactory;

    event RunCreated(string indexed runId, string orgId, bytes32 rosterRoot, uint256 totalAmount);
    event RunApproved(string indexed runId, address checker);
    event RunExecuted(string indexed runId, uint256 paid, uint256 held, bytes32 txData);
    event LineClaimed(string indexed runId, uint256 lineIndex, address dest, uint256 amount);

    error RunAlreadyExists();
    error RunNotFound();
    error OrgNotFound();
    error NotAuthorizedMaker();
    error NotAuthorizedChecker();
    error RunNotApproved();
    error RunAlreadyExecuted();
    error InsufficientVaultBalance();
    error AlreadyClaimed();
    error InvalidProof();
    error InvalidDestination();

    constructor(address _orgFactory) {
        require(_orgFactory != address(0), "factory required");
        orgFactory = _orgFactory;
    }

    function createRun(string calldata orgId, string calldata runId, bytes32 rosterRoot, uint256 totalAmount) external {
        if (bytes(runs[runId].orgId).length != 0) revert RunAlreadyExists();

        OrgFactory factory = OrgFactory(orgFactory);
        address vault = factory.vaultOf(orgId);
        if (vault == address(0)) revert OrgNotFound();

        address maker = factory.makerOf(orgId);
        address owner = factory.ownerOf(orgId);
        bool authorized = maker == address(0) ? (msg.sender == owner) : (msg.sender == maker);
        if (!authorized) revert NotAuthorizedMaker();

        runs[runId] = Run({
            rosterRoot: rosterRoot,
            totalAmount: totalAmount,
            approved: false,
            executed: false,
            checker: address(0),
            orgId: orgId
        });

        emit RunCreated(runId, orgId, rosterRoot, totalAmount);
    }

    function approveRun(string calldata runId, bytes calldata checkerSig) external {
        checkerSig;

        Run storage run = runs[runId];
        if (bytes(run.orgId).length == 0) revert RunNotFound();

        address expectedChecker = OrgFactory(orgFactory).checkerOf(run.orgId);
        if (msg.sender != expectedChecker) revert NotAuthorizedChecker();

        run.approved = true;
        run.checker = msg.sender;

        emit RunApproved(runId, msg.sender);
    }

    function executeRun(string calldata runId) external returns (uint256 paid, uint256 held) {
        Run storage run = runs[runId];
        if (bytes(run.orgId).length == 0) revert RunNotFound();
        if (!run.approved) revert RunNotApproved();
        if (run.executed) revert RunAlreadyExecuted();

        address vaultAddress = OrgFactory(orgFactory).vaultOf(run.orgId);
        if (vaultAddress == address(0)) revert OrgNotFound();

        uint256 vaultBal = Vault(vaultAddress).balance();
        if (vaultBal < run.totalAmount) revert InsufficientVaultBalance();

        run.executed = true;
        Vault(vaultAddress).pull(address(this), run.totalAmount);

        paid = 1;
        held = 0;

        emit RunExecuted(runId, paid, held, bytes32(0));
    }

    function claimLine(
        string calldata runId,
        uint256 lineIndex,
        uint256 amount,
        address dest,
        bytes32[] calldata proof
    ) external {
        Run storage run = runs[runId];
        if (bytes(run.orgId).length == 0) revert RunNotFound();
        if (!run.executed) revert RunNotApproved();
        if (claimed[runId][lineIndex]) revert AlreadyClaimed();
        if (dest == address(0)) revert InvalidDestination();

        bytes32 leaf = keccak256(abi.encodePacked(lineIndex, amount, dest));
        bool ok = MerkleProof.verify(proof, run.rosterRoot, leaf);
        if (!ok) revert InvalidProof();

        claimed[runId][lineIndex] = true;

        address token = Vault(OrgFactory(orgFactory).vaultOf(run.orgId)).usdc();
        IERC20(token).safeTransfer(dest, amount);

        emit LineClaimed(runId, lineIndex, dest, amount);
    }
}
