// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/utils/cryptography/MerkleProof.sol';
// Core protocol Protocol imports
import {IIdentityMerkleAttester} from './interfaces/IIdentityMerkleAttester.sol';
import {Request, Attestation, Claim} from './../../core/libs/Structs.sol';
import {Attester, IAttester, IAttestationsRegistry} from './../../core/Attester.sol';
import {IdentityMerkleGroupProperties, IdentityGroupProperties, IdentityBadgeData, MerkleProofData} from './libs/IdentityMerkleAttesterLib.sol';
import {IAvailableRootsRegistry} from '../../periphery/utils/AvailableRootsRegistry.sol';

/**
 * @title  Identity Merkle Attester
 * @author Kleoverse
 * @notice This attester is for merkle based data.
 * Identity Merkle attester enables users to generate attestations based on data collected from off-chain data source having identity authentication.
 * It uses Identity Badge generated using Signature Attester or similar attester to authenticate the user for data in merkle tree.
 **/
contract IdentityMerkleAttester is IIdentityMerkleAttester, Attester {
  IAvailableRootsRegistry immutable AVAILABLE_ROOTS_REGISTRY;
  address public immutable MIGRATION_CONTRACT;
  mapping(uint256 => mapping(address => address)) internal _sourcesToDestinations;

  modifier onlyMigrationContractOrOwner() {
    require(
      msg.sender == MIGRATION_CONTRACT || msg.sender == owner(),
      'Only migration contract or owner can call this function'
    );
    _;
  }

  /*******************************************************
    INITIALIZATION FUNCTIONS                           
  *******************************************************/
  /**
   * @dev Constructor. Initializes the contract
   * @param attestationsRegistryAddress Attestations Registry contract on which the attester will write attestations
   * @param availableRootsRegistryAddress Registry storing the available groups for this attester
   * @param collectionIdFirst Id of the first collection in which the attester is supposed to record
   * @param collectionIdLast Id of the last collection in which the attester is supposed to record
   * @param migrationContract Address of the migration contract
   */
  constructor(
    address attestationsRegistryAddress,
    address availableRootsRegistryAddress,
    uint256 collectionIdFirst,
    uint256 collectionIdLast,
    address migrationContract
  ) Attester(attestationsRegistryAddress, collectionIdFirst, collectionIdLast) {
    AVAILABLE_ROOTS_REGISTRY = IAvailableRootsRegistry(availableRootsRegistryAddress);
    MIGRATION_CONTRACT = migrationContract;
  }

  /*******************************************************
    MANDATORY FUNCTIONS TO OVERRIDE FROM ATTESTER.SOL
  *******************************************************/

  /**
   * @dev Throws if user request is invalid when verified against
   * @param request users request. Claim of having met the badge requirement
   * @param proofData Merkle proof
   */
  function _verifyRequest(Request calldata request, bytes calldata proofData)
    internal
    virtual
    override
  {
    Claim memory claim = request.claims[0];

    MerkleProofData memory merkleProofData = abi.decode(proofData, (MerkleProofData));

    _verifyAuthentication(merkleProofData);

    if (!AVAILABLE_ROOTS_REGISTRY.isRootAvailableForMe(claim.groupId)) revert GroupNotAvailable();

    bytes32 hashedAccount = keccak256(
      abi.encodePacked(merkleProofData.accountId, claim.claimedValue)
    );

    if (!MerkleProof.verify(merkleProofData.path, bytes32(claim.groupId), hashedAccount))
      revert ClaimInvalid();
  }

  /**
   * @dev Throws if user attestations deletion request is not made by its owner
   * @param attestations attestations to delete
   */
  function _verifyAttestationsDeletionRequest(Attestation[] memory attestations, bytes calldata)
    internal
    view
    override
  {
    for (uint256 i = 0; i < attestations.length; i++) {
      if (attestations[i].owner != msg.sender)
        revert NotAttestationOwner(attestations[i].collectionId, msg.sender);
      address destination = _getDestinationOfSource(attestations[i].collectionId, msg.sender);
      if (destination != msg.sender) revert SourceDestinationNotSame(msg.sender, destination);
    }
  }

  /**
   * @dev Returns attestations that will be recorded, constructed from the user request
   * @param request users request. Claim of having met the badge requirement
   */
  function buildAttestations(Request calldata request, bytes calldata)
    public
    view
    virtual
    override(Attester)
    returns (Attestation[] memory)
  {
    Claim memory claim = request.claims[0];
    IdentityMerkleGroupProperties memory groupProperties = abi.decode(
      claim.extraData,
      (IdentityMerkleGroupProperties)
    );

    Attestation[] memory attestations = new Attestation[](1);

    uint256 attestationCollectionId = AUTHORIZED_COLLECTION_ID_FIRST + groupProperties.groupIndex;

    if (attestationCollectionId > AUTHORIZED_COLLECTION_ID_LAST)
      revert CollectionIdOutOfBound(attestationCollectionId);

    address issuer = address(this);

    attestations[0] = Attestation(
      attestationCollectionId,
      request.destination,
      issuer,
      claim.claimedValue,
      groupProperties.generationTimestamp,
      ''
    );
    return (attestations);
  }

  /*******************************************************
    OPTIONAL HOOK VIRTUAL FUNCTIONS FROM ATTESTER.SOL
  *******************************************************/

  /**
   * @dev Hook run before recording the attestation.
   * Throws if source already used for another destination
   * @param request users request. Claim of having met the badge requirement
   * @param proofData provided to back the request.
   */
  function _beforeRecordAttestations(Request calldata request, bytes calldata proofData)
    internal
    virtual
    override
  {
    Claim memory claim = request.claims[0];
    IdentityMerkleGroupProperties memory groupProperties = abi.decode(
      claim.extraData,
      (IdentityMerkleGroupProperties)
    );
    uint256 attestationCollectionId = AUTHORIZED_COLLECTION_ID_FIRST + groupProperties.groupIndex;
    address currentDestination = _getDestinationOfSource(attestationCollectionId, msg.sender);

    if (currentDestination != address(0) && currentDestination != request.destination) {
      revert SourceAlreadyUsed(msg.sender);
    }

    _setDestinationForSource(attestationCollectionId, msg.sender, request.destination);
  }

  /**
   * @dev Hook run before deleting the attestations.
   * Unsets destination for the source and collectionId
   * @param attestations Attestations that will be deleted
   * @param proofData Data sent along the request to prove its validity
   */
  function _beforeDeleteAttestations(Attestation[] memory attestations, bytes calldata proofData)
    internal
    override
  {
    for (uint256 i = 0; i < attestations.length; i++) {
      _setDestinationForSource(attestations[i].collectionId, msg.sender, address(0));
    }
  }

  /*******************************************************
    Identity Merkle Attester Specific Functions
  *******************************************************/

  function setDestinationForSource(
    uint256 attestationId,
    address source,
    address destination
  ) external onlyMigrationContractOrOwner {
    _setDestinationForSource(attestationId, source, destination);
  }

  /**
   * @dev Getter, returns the last attestation's destination of a source
   * @param attestationId Id of the specific attestation mapped to source
   * @param source address used
   **/
  function getDestinationOfSource(uint256 attestationId, address source)
    external
    view
    override
    returns (address)
  {
    return _getDestinationOfSource(attestationId, source);
  }

  /**
   * @dev Internal Setter, sets the mapping of source-destination for attestationId
   * @param attestationId Id of the specific attestation mapped to source
   * @param source address used
   * @param destination address of the attestation destination
   **/
  function _setDestinationForSource(
    uint256 attestationId,
    address source,
    address destination
  ) internal virtual {
    _sourcesToDestinations[attestationId][source] = destination;
    emit SourceToDestinationUpdated(attestationId, source, destination);
  }

  /**
   * @dev Internal Getter, returns the last attestation's destination of a source
   * @param attestationId Id of the specific attestation mapped to source
   * @param source address used
   **/
  function _getDestinationOfSource(uint256 attestationId, address source)
    internal
    view
    returns (address)
  {
    return _sourcesToDestinations[attestationId][source];
  }

  /**
   * @dev Verifies the off-chain oauth identity badge owned by user
   * @param merkleProofData Merkle proof data along containing identityAttestationId
   **/
  function _verifyAuthentication(MerkleProofData memory merkleProofData) internal {
    if (!ATTESTATIONS_REGISTRY.hasAttestation(merkleProofData.identityAttestationId, msg.sender))
      revert IdentityDoesNotExist();

    bytes memory identityExtraData = ATTESTATIONS_REGISTRY.getAttestationExtraData(
      merkleProofData.identityAttestationId,
      msg.sender
    );

    IdentityGroupProperties memory identityData = abi.decode(
      identityExtraData,
      (IdentityGroupProperties)
    );

    if (
      keccak256(abi.encodePacked(identityData.badgeType)) != keccak256(abi.encodePacked('identity'))
    ) {
      revert BadgeInvalid();
    }

    IdentityBadgeData memory badgeData = abi.decode(identityData.badgeData, (IdentityBadgeData));
    if (
      !(keccak256(abi.encodePacked(merkleProofData.accountId)) ==
        keccak256(abi.encodePacked(badgeData.accountId)))
    ) revert IdentityInvalid();
  }
}
