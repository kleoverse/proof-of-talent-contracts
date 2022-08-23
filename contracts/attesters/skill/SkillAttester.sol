// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;

import {IERC1155} from '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
// Core protocol Protocol imports
import {ISkillAttester} from './interfaces/ISkillAttester.sol';
import {Request, Attestation, Claim} from './../../core/libs/Structs.sol';
import {Attester, IAttester, IAttestationsRegistry} from './../../core/Attester.sol';
import {SkillGroupProperties} from './libs/SkillAttesterLib.sol';

contract SkillAttester is ISkillAttester, Attester, Ownable {
  // The deployed contract will need to be authorized to write into the Attestation registry
  // It should get write access on attestation collections from AUTHORIZED_COLLECTION_ID_FIRST to AUTHORIZED_COLLECTION_ID_LAST.
  uint256 public immutable AUTHORIZED_COLLECTION_ID_FIRST;
  uint256 public immutable AUTHORIZED_COLLECTION_ID_LAST;
  IERC1155 SKILL_BADGE;
  mapping(uint256 => mapping(address => address)) internal _sourcesToDestinations;

  /*******************************************************
    INITIALIZATION FUNCTIONS                           
  *******************************************************/
  /**
   * @dev Constructor. Initializes the contract
   * @param attestationsRegistryAddress Attestations Registry contract on which the attester will write attestations
   * @param collectionIdFirst Id of the first collection in which the attester is supposed to record
   * @param collectionIdLast Id of the last collection in which the attester is supposed to record
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
    uint256 tokenBalance = SKILL_BADGE.balanceOf(msg.sender, claim.groupId);

    if (tokenBalance < claim.claimedValue)
      revert ClaimValueInvalid(tokenBalance, claim.claimedValue);
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
    SkillGroupProperties memory groupProperties = abi.decode(
      claim.extraData,
      (SkillGroupProperties)
    );

    Attestation[] memory attestations = new Attestation[](1);

    uint256 attestationCollectionId = AUTHORIZED_COLLECTION_ID_FIRST + claim.groupId;

    address issuer = address(this);

    attestations[0] = Attestation(
      attestationCollectionId,
      request.destination,
      issuer,
      claim.claimedValue,
      groupProperties.generationTimestamp,
      claim.extraData
    );
    return (attestations);
  }

  /*******************************************************
    OPTIONAL HOOK VIRTUAL FUNCTIONS FROM ATTESTER.SOL
  *******************************************************/

  /**
   * @dev Hook run before recording the attestation.
   * Throws if ticket already used and not a renewal (e.g destination different that last)
   * @param request users request. Claim of having an account part of a group of accounts
   * @param proofData provided to back the request. snark input and snark proof
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

  /*******************************************************
    Github Attester Specific Functions
  *******************************************************/

  /**
   * @dev Getter, returns the last attestation destination of a source
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

  function _setDestinationForSource(
    uint256 attestationId,
    address source,
    address destination
  ) internal virtual {
    _sourcesToDestinations[attestationId][source] = destination;
    emit SourceToDestinationUpdated(attestationId, source, destination);
  }

  function _getDestinationOfSource(uint256 attestationId, address source)
    internal
    view
    returns (address)
  {
    return _sourcesToDestinations[attestationId][source];
  }

  function setSkillBadge(address skillBadgeAddress) public onlyOwner {
    SKILL_BADGE = IERC1155(skillBadgeAddress);
  }
}
