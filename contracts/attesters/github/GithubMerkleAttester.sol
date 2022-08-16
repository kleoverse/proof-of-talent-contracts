// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/utils/cryptography/MerkleProof.sol';
// Core protocol Protocol imports
import {IGithubMerkleAttester} from './interfaces/IGithubMerkleAttester.sol';
import {Request, Attestation, Claim} from './../../core/libs/Structs.sol';
import {Attester, IAttester, IAttestationsRegistry} from './../../core/Attester.sol';
import {GithubGroupProperties, IdentityGroupProperties, MerkleProofData} from './libs/GithubMerkleAttesterLib.sol';
import {IAvailableRootsRegistry} from '../../periphery/utils/AvailableRootsRegistry.sol';

contract GithubMerkleAttester is IGithubMerkleAttester, Attester {
  // The deployed contract will need to be authorized to write into the Attestation registry
  // It should get write access on attestation collections from AUTHORIZED_COLLECTION_ID_FIRST to AUTHORIZED_COLLECTION_ID_LAST.
  uint256 public immutable AUTHORIZED_COLLECTION_ID_FIRST;
  uint256 public immutable AUTHORIZED_COLLECTION_ID_LAST;
  IAvailableRootsRegistry immutable AVAILABLE_ROOTS_REGISTRY;
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
    address availableRootsRegistryAddress,
    uint256 collectionIdFirst,
    uint256 collectionIdLast
  ) Attester(attestationsRegistryAddress) {
    AUTHORIZED_COLLECTION_ID_FIRST = collectionIdFirst;
    AUTHORIZED_COLLECTION_ID_LAST = collectionIdLast;
    AVAILABLE_ROOTS_REGISTRY = IAvailableRootsRegistry(availableRootsRegistryAddress);
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
    GithubGroupProperties memory groupProperties = abi.decode(
      claim.extraData,
      (GithubGroupProperties)
    );

    Attestation[] memory attestations = new Attestation[](1);

    uint256 attestationCollectionId = AUTHORIZED_COLLECTION_ID_FIRST + groupProperties.groupIndex;

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
      !(keccak256(abi.encodePacked(merkleProofData.accountId)) ==
        keccak256(abi.encodePacked(identityData.accountId)))
    ) revert IdentityInvalid();
  }
}
