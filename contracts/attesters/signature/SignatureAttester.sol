// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol';
// Core protocol Protocol imports
import {ISignatureAttester} from './interfaces/ISignatureAttester.sol';
import {Request, Attestation, Claim} from './../../core/libs/Structs.sol';
import {Attester, IAttester, IAttestationsRegistry} from './../../core/Attester.sol';
import {EIP712Signature} from './libs/SignatureAttesterLib.sol';

/**
 * @title  Signature Attester
 * @author Sahil Vasava (https://github.com/sahilvasava)
 * @notice This attester is based on ECDSA signature verfication method.
 * Signature attester enables users to generate attestations based on signature signed using ECDSA scheme off-chain by a centralised verifier.
 **/
contract SignatureAttester is ISignatureAttester, Attester, EIP712 {
  bytes32 private constant _ATTESTATION_REQUEST_TYPEHASH =
    keccak256(
      'AttestationRequest(uint256 groupId,uint256 claimedValue,bytes extraData,address destination,uint256 deadline)'
    );

  // The deployed contract will need to be authorized to write into the Attestation registry
  // It should get write access on attestation collections from AUTHORIZED_COLLECTION_ID_FIRST to AUTHORIZED_COLLECTION_ID_LAST.
  uint256 public immutable AUTHORIZED_COLLECTION_ID_FIRST;
  uint256 public immutable AUTHORIZED_COLLECTION_ID_LAST;
  address public immutable VERIFIER;
  mapping(uint256 => mapping(address => address)) internal _sourcesToDestinations;

  /*******************************************************
    INITIALIZATION FUNCTIONS                           
  *******************************************************/
  /**
   * @dev Constructor. Initializes the contract
   * @param attestationsRegistryAddress Attestations Registry contract on which the attester will write attestations
   * @param collectionIdFirst Id of the first collection in which the attester is supposed to record
   * @param collectionIdLast Id of the last collection in which the attester is supposed to record
   * @param verifierAddress Address of the off-chain attester signer
   */
  constructor(
    address attestationsRegistryAddress,
    uint256 collectionIdFirst,
    uint256 collectionIdLast,
    address verifierAddress
  ) Attester(attestationsRegistryAddress) EIP712('SignatureAttester', '1') {
    AUTHORIZED_COLLECTION_ID_FIRST = collectionIdFirst;
    AUTHORIZED_COLLECTION_ID_LAST = collectionIdLast;
    VERIFIER = verifierAddress;
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
    EIP712Signature memory sig = abi.decode(proofData, (EIP712Signature));
    if (sig.deadline < block.timestamp) {
      revert SignatureDeadlineExpired(sig.deadline);
    }
    bytes32 structHash = keccak256(
      abi.encode(
        _ATTESTATION_REQUEST_TYPEHASH,
        request.claims[0].groupId,
        request.claims[0].claimedValue,
        keccak256(request.claims[0].extraData),
        request.destination,
        sig.deadline
      )
    );

    bytes32 hash = _hashTypedDataV4(structHash);

    address signer = ECDSA.recover(hash, sig.v, sig.r, sig.s);
    if (signer != VERIFIER) {
      revert SignatureInvalid(VERIFIER, signer);
    }
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
    Signature Attester Specific Functions
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
