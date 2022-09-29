// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;

import {IERC1155} from '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
// Core protocol Protocol imports
import {ISkillAttester} from './interfaces/ISkillAttester.sol';
import {Request, Attestation, Claim} from './../../core/libs/Structs.sol';
import {Attester, IAttester, IAttestationsRegistry} from './../../core/Attester.sol';

/**
 * @title  Skill Attester
 * @author Kleoverse
 * @notice This attester uses ERC721/ERC1155 balance to generate attestations.
 * Skill attester enables users to generate attestations based on amount of tokens based on weights given to those tokens stored in Skill badge contract.
 * The basic idea to map different ERC721/ERC1155 (including cred badges in attestation registry) to skills with specific weights attached.
 *
 * Skill Token amount = Cred Badge[0] * Weight[0] + Cred Badge[1] * Weight[1] + ... + Cred Badge[n] * Weight[n]
 **/
contract SkillAttester is ISkillAttester, Attester, Ownable {
  // The deployed contract will need to be authorized to write into the Attestation registry
  // It should get write access on attestation collections from AUTHORIZED_COLLECTION_ID_FIRST to AUTHORIZED_COLLECTION_ID_LAST.
  uint256 public immutable AUTHORIZED_COLLECTION_ID_FIRST;
  uint256 public immutable AUTHORIZED_COLLECTION_ID_LAST;
  IERC1155 public immutable SKILL_BADGE;
  mapping(uint256 => mapping(address => address)) internal _sourcesToDestinations;

  /*******************************************************
    INITIALIZATION FUNCTIONS                           
  *******************************************************/
  /**
   * @dev Constructor. Initializes the contract
   * @param attestationsRegistryAddress Attestations Registry contract on which the attester will write attestations
   * @param collectionIdFirst Id of the first collection in which the attester is supposed to record
   * @param collectionIdLast Id of the last collection in which the attester is supposed to record
   * @param skillBadgeAddress Skill Badge contract where the cred to skill weights are stored
   */
  constructor(
    address attestationsRegistryAddress,
    uint256 collectionIdFirst,
    uint256 collectionIdLast,
    address skillBadgeAddress
  ) Attester(attestationsRegistryAddress) {
    AUTHORIZED_COLLECTION_ID_FIRST = collectionIdFirst;
    AUTHORIZED_COLLECTION_ID_LAST = collectionIdLast;
    SKILL_BADGE = IERC1155(skillBadgeAddress);
  }

  /*******************************************************
    MANDATORY FUNCTIONS TO OVERRIDE FROM ATTESTER.SOL
  *******************************************************/

  /**
   * @dev Throws if user request is invalid when verified against
   * @param request users request. Claim of having met the badge requirement
   * @param proofData Signature proof
   */
  function _verifyRequest(Request calldata request, bytes calldata proofData)
    internal
    virtual
    override
  {
    Claim memory claim = request.claims[0];
    uint256 attestationCollectionId = AUTHORIZED_COLLECTION_ID_FIRST + claim.groupId;
    uint256 tokenBalance = SKILL_BADGE.balanceOf(msg.sender, attestationCollectionId);

    if (tokenBalance < claim.claimedValue)
      revert ClaimValueInvalid(tokenBalance, claim.claimedValue);
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

    Attestation[] memory attestations = new Attestation[](1);

    uint256 attestationCollectionId = AUTHORIZED_COLLECTION_ID_FIRST + claim.groupId;

    if (attestationCollectionId > AUTHORIZED_COLLECTION_ID_LAST)
      revert CollectionIdOutOfBound(attestationCollectionId);

    address issuer = address(this);

    attestations[0] = Attestation(
      attestationCollectionId,
      request.destination,
      issuer,
      claim.claimedValue,
      uint32(block.timestamp),
      claim.extraData
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
    uint256 attestationCollectionId = AUTHORIZED_COLLECTION_ID_FIRST + request.claims[0].groupId;
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
    Skill Attester Specific Functions
  *******************************************************/

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
}
