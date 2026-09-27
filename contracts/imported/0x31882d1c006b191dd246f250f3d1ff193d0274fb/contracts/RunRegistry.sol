// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {OrgFactory} from "./OrgFactory.sol";
import {Vault} from "./Vault.sol";

contract RunRegistry is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Run {
        bytes32 rosterRoot;
        uint256 totalAmount;
        /// @dev Amount pulled from the vault and held by this contract for claims.
        uint256 heldAmount;
        bool approved;
        bool executed;
        address checker;
        string orgId;
    }

    mapping(string runId => Run) public runs;
    mapping(string runId => mapping(uint256 lineIndex => bool)) public claimed;
    mapping(string runId => uint256) public executedAt;

    /// @notice Org owner may reclaim residual after this many seconds post-execution.
    uint256 public constant CLAIM_WINDOW = 90 days;

    address public orgFactory;
    address public immutable deployer;

    event RunCreated(string indexed runId, string orgId, bytes32 rosterRoot, uint256 totalAmount);
    event RunApproved(string indexed runId, address checker);
    /// @param runId  The run identifier.
    /// @param pulled Exact USDC amount pulled from the vault into this contract.
    /// @param txData Reserved for future use.
    event RunExecuted(string indexed runId, uint256 pulled, bytes32 txData);
    event LineClaimed(string indexed runId, uint256 lineIndex, address dest, uint256 amount);
    event OrgFactorySet(address factory);

    error RunAlreadyExists();
    error RunNotFound();
    error OrgNotFound();
    error NotAuthorizedMaker();
    error NotAuthorizedChecker();
    error RunNotApproved();
    error RunAlreadyExecuted();
    error RunNotExecuted();
    error InsufficientVaultBalance();
    error AlreadyClaimed();
    error InvalidProof();
    error InvalidDestination();
    error AlreadyInitialized();
    error NotDeployer();
    error ZeroAmount();
    error ZeroFactory();
    error ClaimWindowOpen();
    error NoResidual();

    /// @param _orgFactory Pass address(0) to bootstrap the circular dependency;
    ///                     call setOrgFactory once after OrgFactory is deployed.
    constructor(address _orgFactory) {
        deployer = msg.sender;
        orgFactory = _orgFactory;
    }

    /// @notice One-time setter to wire OrgFactory after deployment.
    ///         Can only be called by the original deployer and only while orgFactory is zero.
    function setOrgFactory(address _orgFactory) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (orgFactory != address(0)) revert AlreadyInitialized();
        if (_orgFactory == address(0)) revert ZeroFactory();
        orgFactory = _orgFactory;
        emit OrgFactorySet(_orgFactory);
    }

    function createRun(
        string calldata orgId,
        string calldata runId,
        bytes32 rosterRoot,
        uint256 totalAmount
    ) external {
        if (bytes(runs[runId].orgId).length != 0) revert RunAlreadyExists();
        if (totalAmount == 0) revert ZeroAmount();

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
            heldAmount: 0,
            approved: false,
            executed: false,
            checker: address(0),
            orgId: orgId
        });

        emit RunCreated(runId, orgId, rosterRoot, totalAmount);
    }

    /// @notice The checker calls this to approve a run.
    ///         The `checkerSig` parameter is accepted for off-chain audit trail purposes
    ///         but on-chain security relies solely on msg.sender == checkerOf(orgId).
    ///         No signature verification is performed on-chain.
    function approveRun(string calldata runId, bytes calldata checkerSig) external {
        checkerSig; // accepted for audit trail, not verified on-chain

        Run storage run = runs[runId];
        if (bytes(run.orgId).length == 0) revert RunNotFound();

        address expectedChecker = OrgFactory(orgFactory).checkerOf(run.orgId);
        if (msg.sender != expectedChecker) revert NotAuthorizedChecker();

        run.approved = true;
        run.checker = msg.sender;

        emit RunApproved(runId, msg.sender);
    }

    /// @notice Pulls run.totalAmount from the vault into this contract for per-line claims.
    ///         Each run's funds are tracked in run.heldAmount — no commingling between runs.
    function executeRun(string calldata runId) external returns (uint256 pulled) {
        Run storage run = runs[runId];
        if (bytes(run.orgId).length == 0) revert RunNotFound();
        if (!run.approved) revert RunNotApproved();
        if (run.executed) revert RunAlreadyExecuted();

        address vaultAddress = OrgFactory(orgFactory).vaultOf(run.orgId);
        if (vaultAddress == address(0)) revert OrgNotFound();

        uint256 vaultBal = Vault(vaultAddress).balance();
        if (vaultBal < run.totalAmount) revert InsufficientVaultBalance();

        run.executed = true;
        run.heldAmount = run.totalAmount;
        executedAt[runId] = block.timestamp;
        Vault(vaultAddress).pull(address(this), run.totalAmount);

        pulled = run.totalAmount;
        emit RunExecuted(runId, pulled, bytes32(0));
    }

    function claimLine(
        string calldata runId,
        uint256 lineIndex,
        uint256 amount,
        address dest,
        bytes32[] calldata proof
    ) external nonReentrant {
        Run storage run = runs[runId];
        if (bytes(run.orgId).length == 0) revert RunNotFound();
        if (!run.executed) revert RunNotExecuted(); // was misleadingly RunNotApproved
        if (claimed[runId][lineIndex]) revert AlreadyClaimed();
        if (dest == address(0)) revert InvalidDestination();
        if (amount == 0) revert ZeroAmount();

        // runId is included in the leaf to prevent cross-run replay attacks
        bytes32 leaf = keccak256(abi.encodePacked(runId, lineIndex, amount, dest));
        bool ok = MerkleProof.verify(proof, run.rosterRoot, leaf);
        if (!ok) revert InvalidProof();

        // Deduct from this run's held balance — enforces per-run accounting
        run.heldAmount -= amount; // reverts on underflow if claims exceed pulled amount

        claimed[runId][lineIndex] = true;

        address token = Vault(OrgFactory(orgFactory).vaultOf(run.orgId)).usdc();
        IERC20(token).safeTransfer(dest, amount);

        emit LineClaimed(runId, lineIndex, dest, amount);
    }

    /// @notice After the 90-day claim window, the org owner may recover any unclaimed residual.
    ///         This prevents funds from being permanently locked when workers never claim.
    function reclaimResidual(string calldata runId) external nonReentrant {
        Run storage run = runs[runId];
        if (bytes(run.orgId).length == 0) revert RunNotFound();
        if (!run.executed) revert RunNotExecuted();
        if (block.timestamp < executedAt[runId] + CLAIM_WINDOW) revert ClaimWindowOpen();
        if (run.heldAmount == 0) revert NoResidual();

        address owner = OrgFactory(orgFactory).ownerOf(run.orgId);
        if (msg.sender != owner) revert NotAuthorizedMaker();

        uint256 residual = run.heldAmount;
        run.heldAmount = 0;

        address token = Vault(OrgFactory(orgFactory).vaultOf(run.orgId)).usdc();
        IERC20(token).safeTransfer(owner, residual);

        emit LineClaimed(runId, type(uint256).max, owner, residual);
    }
}
