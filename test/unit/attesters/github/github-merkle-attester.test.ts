import { expect } from 'chai';
import hre from 'hardhat';
import {
  AttestationsRegistry,
  AvailableRootsRegistry,
  Badges,
  GithubAttester,
  GithubMerkleAttester,
  IdentityAttester,
} from 'types';
import { RequestStruct } from 'types/Attester';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, ethers, utils } from 'ethers';
import { Deployed0 } from 'tasks/deploy-tasks/full/0-deploy-core-and-hydra-s1-simple-and-soulbound.task';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';
import {
  generateGithubMerkleAccounts,
  GithubMerkleData,
  generateGithubMerkleLists,
  generateGithubMerkleAttesterGroups,
  GithubMerkleGroup,
  encodeGithubMerkleGroupProperties,
  encodeGithubMerkleProofData,
  getEventArgs,
  encodeIdentityGroupProperties,
  generateEIP712TypedSignData,
  IdentityAttesterDomainName,
  IdentityAccountData,
  generateIdentityAccounts,
  generateIdentityLists,
  generateIdentityAttesterGroups,
} from '../../../utils';
import { keccak256, KVMerkleTree } from '@sismo-core/hydra-s1';
import MerkleTree from 'merkletreejs';

const config = deploymentsConfig[hre.network.name];
const collectionIdFirst = BigNumber.from(config.githubMerkleAttester.collectionIdFirst);
const collectionIdLast = BigNumber.from(config.githubMerkleAttester.collectionIdLast);

describe('Test Github Merkle attester contract', () => {
  let chainId: number;

  // contracts
  let attestationsRegistry: AttestationsRegistry;
  let availableRootsRegistry: AvailableRootsRegistry;
  let githubAttester: GithubAttester;
  let identityAttester: IdentityAttester;
  let githubMerkleAttester: GithubMerkleAttester;
  let badges: Badges;

  // Merkle tree
  let registryTree: MerkleTree;

  // Test Signers
  let signers: SignerWithAddress[];
  let deployer: SignerWithAddress;
  let randomSigner: SignerWithAddress;
  let proxyAdminSigner: SignerWithAddress;
  let attesterOracle: SignerWithAddress;

  // Test accounts
  let source1: GithubMerkleData;
  let source2: GithubMerkleData;
  let destination1: SignerWithAddress;
  let destination2: SignerWithAddress;

  // Data source test
  let source1Value: BigNumber;
  let accountsTree1: MerkleTree;
  let accountsTree2: MerkleTree;
  let group1: GithubMerkleGroup;
  let group2: GithubMerkleGroup;
  let root: string;
  let identityAttestationId: BigNumber;

  // Valid request and proof
  let request: RequestStruct;

  before(async () => {
    signers = await hre.ethers.getSigners();
    [deployer, randomSigner, proxyAdminSigner, attesterOracle, destination1, destination2] =
      signers;

    let accounts: GithubMerkleData[] = await generateGithubMerkleAccounts(signers);

    source1 = accounts[0];
    source2 = accounts[1];

    // Generate data source
    const allList = await generateGithubMerkleLists(accounts);
    const { dataFormat, groups } = await generateGithubMerkleAttesterGroups(allList);

    registryTree = dataFormat.registryTree;
    accountsTree1 = dataFormat.accountsTrees[0];
    accountsTree2 = dataFormat.accountsTrees[1];
    group1 = groups[0];
    group2 = groups[1];
    source1Value = BigNumber.from(allList[0][source1.identifier]); // accountsTree1.getValue(BigNumber.from(source1.identifier).toHexString());
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/

  describe('Deployments', () => {
    it('Should deploy and setup core', async () => {
      ({
        attestationsRegistry,
        badges,
        identityAttester,
        githubMerkleAttester,
        availableRootsRegistry,
      } = (await hre.run('0-deploy-core-and-hydra-s1-simple-and-soulbound', {
        options: { log: false },
      })) as Deployed0);
      root = accountsTree1.getHexRoot();
      await availableRootsRegistry.registerRootForAttester(githubMerkleAttester.address, root);
      expect(
        await availableRootsRegistry.isRootAvailableForAttester(githubMerkleAttester.address, root)
      ).to.equal(true);
    });
    it('Should generate identity attestations', async () => {
      const deadline = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      let accounts: IdentityAccountData[] = await generateIdentityAccounts(signers);

      const allList = await generateIdentityLists(accounts);
      const { groups } = await generateIdentityAttesterGroups(allList);

      const request = {
        claims: [
          {
            groupId: groups[1].id,
            claimedValue: 1,
            extraData: encodeIdentityGroupProperties(
              groups[1].properties,
              source1.identifier,
              'username'
            ),
          },
        ],
        destination: deployer.address,
      };

      const signData = generateEIP712TypedSignData(
        request,
        identityAttester.address,
        deadline,
        IdentityAttesterDomainName
      );
      const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
      const { r, s, v } = utils.splitSignature(sig);
      const data = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [v, r, s, deadline]
      );
      const tx = await identityAttester.generateAttestations(request, data);
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationGenerated');
      identityAttestationId = args.attestation.collectionId;

      expect(args.attestation.issuer).to.equal(identityAttester.address);
      expect(args.attestation.owner).to.equal(BigNumber.from(deployer.address).toHexString());
      expect(args.attestation.value).to.equal(1);
      expect(args.attestation.timestamp).to.equal(groups[1].properties.generationTimestamp);
      expect(args.attestation.extraData).to.equal(request.claims[0].extraData);

      // 2nd Identity Attestation
      const request2 = {
        claims: [
          {
            groupId: groups[2].id,
            claimedValue: 1,
            extraData: encodeIdentityGroupProperties(
              groups[2].properties,
              source2.identifier,
              'username2'
            ),
          },
        ],
        destination: deployer.address,
      };

      const signData2 = generateEIP712TypedSignData(
        request2,
        identityAttester.address,
        deadline,
        IdentityAttesterDomainName
      );
      const sig2 = await deployer._signTypedData(
        signData2.domain,
        signData2.types,
        signData2.message
      );
      const splitSig = utils.splitSignature(sig2);
      const data2 = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [splitSig.v, splitSig.r, splitSig.s, deadline]
      );
      await (await identityAttester.generateAttestations(request2, data2)).wait();
    });
  });

  /*************************************************************************************/
  /***************************** GENERATE VALID ATTESTATION ****************************/
  /*************************************************************************************/

  describe('Generate valid attestation', () => {
    it('Should generate attestation', async () => {
      request = {
        claims: [
          {
            groupId: root,
            claimedValue: source1Value,
            extraData: encodeGithubMerkleGroupProperties(group1.properties, source1.identifier),
          },
        ],
        destination: destination1.address,
      };

      const path = accountsTree1.getHexProof(
        ethers.utils.keccak256(
          ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
        )
      );
      const data = encodeGithubMerkleProofData(path, source1.identifier, identityAttestationId);
      const tx = await githubMerkleAttester.generateAttestations(request, data);
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationGenerated');

      expect(args.attestation.issuer).to.equal(githubMerkleAttester.address);
      expect(args.attestation.owner).to.equal(BigNumber.from(destination1.address).toHexString());
      expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(0));
      expect(args.attestation.value).to.equal(0);
      expect(args.attestation.timestamp).to.equal(group1.properties.generationTimestamp);
    });

    it('Should update existing attestation', async () => {
      request = {
        claims: [
          {
            groupId: root,
            claimedValue: source1Value,
            extraData: encodeGithubMerkleGroupProperties(group1.properties, source1.identifier),
          },
        ],
        destination: destination1.address,
      };

      const path = accountsTree1.getHexProof(
        ethers.utils.keccak256(
          ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
        )
      );
      const data = encodeGithubMerkleProofData(path, source1.identifier, identityAttestationId);
      const tx = await githubMerkleAttester.generateAttestations(request, data);
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationGenerated');

      expect(args.attestation.issuer).to.equal(githubMerkleAttester.address);
      expect(args.attestation.owner).to.equal(BigNumber.from(destination1.address).toHexString());
      expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(0));
      expect(args.attestation.value).to.equal(0);
      expect(args.attestation.timestamp).to.equal(group1.properties.generationTimestamp);
    });
  });

  /*************************************************************************************/
  /********************************* VERIFY REQUEST ************************************/
  /*************************************************************************************/

  describe('Verify request', () => {
    /****************************************/
    /************* _validateInput() *********/
    /****************************************/
    it('Should revert due to invalid root', async () => {
      const invalidRoot = accountsTree2.getHexRoot();
      request = {
        claims: [
          {
            groupId: invalidRoot,
            claimedValue: source1Value,
            extraData: encodeGithubMerkleGroupProperties(group2.properties, source1.identifier),
          },
        ],
        destination: destination1.address,
      };

      const path = accountsTree2.getHexProof(
        ethers.utils.keccak256(
          ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
        )
      );
      const data = encodeGithubMerkleProofData(path, source1.identifier, identityAttestationId);
      await expect(
        githubMerkleAttester.generateAttestations(request, data)
      ).to.be.revertedWithCustomError(githubMerkleAttester, 'GroupNotAvailable');
    });
    /****************************************/
    /************** _verifyProof() **********/
    /****************************************/
    it('Should revert due to invalid claim', async () => {
      request = {
        claims: [
          {
            groupId: root,
            claimedValue: source1Value.add(1),
            extraData: encodeGithubMerkleGroupProperties(group1.properties, source1.identifier),
          },
        ],
        destination: destination1.address,
      };

      const path = accountsTree1.getHexProof(
        ethers.utils.keccak256(
          ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
        )
      );
      const data = encodeGithubMerkleProofData(path, source1.identifier, identityAttestationId);
      await expect(
        githubMerkleAttester.generateAttestations(request, data)
      ).to.be.revertedWithCustomError(githubMerkleAttester, 'ClaimInvalid');
    });
    it('Should revert due to invalid identity', async () => {
      request = {
        claims: [
          {
            groupId: root,
            claimedValue: source1Value,
            extraData: encodeGithubMerkleGroupProperties(group1.properties, source1.identifier),
          },
        ],
        destination: destination1.address,
      };

      const path = accountsTree1.getHexProof(
        ethers.utils.keccak256(
          ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
        )
      );
      const data = encodeGithubMerkleProofData(
        path,
        source1.identifier,
        identityAttestationId.add(1)
      );
      await expect(
        githubMerkleAttester.generateAttestations(request, data)
      ).to.be.revertedWithCustomError(githubMerkleAttester, 'IdentityInvalid');
    });
    it('Should revert due to unexisting identity', async () => {
      request = {
        claims: [
          {
            groupId: root,
            claimedValue: source1Value,
            extraData: encodeGithubMerkleGroupProperties(group1.properties, source1.identifier),
          },
        ],
        destination: destination1.address,
      };

      const path = accountsTree1.getHexProof(
        ethers.utils.keccak256(
          ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
        )
      );
      const data = encodeGithubMerkleProofData(
        path,
        source1.identifier,
        identityAttestationId.add(2)
      );
      await expect(
        githubMerkleAttester.generateAttestations(request, data)
      ).to.be.revertedWithCustomError(githubMerkleAttester, 'IdentityDoesNotExist');
    });
  });
  /*************************************************************************************/
  /************************** BEFORE RECORD ATTESTATION ********************************/
  /*************************************************************************************/
  describe('Before record attestation', () => {
    it('Should revert due to source having already been used', async () => {
      request = {
        claims: [
          {
            groupId: root,
            claimedValue: source1Value,
            extraData: encodeGithubMerkleGroupProperties(group1.properties, source1.identifier),
          },
        ],
        destination: destination2.address,
      };

      const path = accountsTree1.getHexProof(
        ethers.utils.keccak256(
          ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
        )
      );
      const data = encodeGithubMerkleProofData(path, source1.identifier, identityAttestationId);
      await expect(githubMerkleAttester.generateAttestations(request, data))
        .to.be.revertedWithCustomError(githubMerkleAttester, `SourceAlreadyUsed`)
        .withArgs(deployer.address);
    });
  });
});
