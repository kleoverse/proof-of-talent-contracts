import { expect } from 'chai';
import hre from 'hardhat';
import {
  AttestationsRegistry,
  AvailableRootsRegistry,
  Badges,
  CommitmentMapperRegistry,
  GithubAttesterOracle,
  HydraS1SimpleAttester,
} from 'types';
import { RequestStruct } from 'types/Attester';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { CommitmentMapperTester } from '@sismo-core/commitment-mapper-tester-js';
import {
  EddsaPublicKey,
  HydraS1Account,
  HydraS1Prover,
  KVMerkleTree,
  SnarkProof,
  SNARK_FIELD,
} from '@sismo-core/hydra-s1';
import { BigNumber } from 'ethers';
import { Deployed0 } from 'tasks/deploy-tasks/full/0-deploy-core-and-hydra-s1-simple-and-soulbound.task';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';
import {
  encodeGithubGroupProperties,
  encodeGroupProperties,
  generateAttesterGroups,
  generateGithubAccounts,
  generateGithubAttesterGroups,
  generateGithubLists,
  generateGroupIdFromEncodedProperties,
  generateGroupIdFromProperties,
  generateHydraS1Accounts,
  generateLists,
  generateTicketIdentifier,
  GithubAccountData,
  GithubGroup,
  Group,
  toBytes,
} from '../../../utils';
import { getEventArgs } from '../../../utils/expectEvent';

const config = deploymentsConfig[hre.network.name];
const collectionIdFirst = BigNumber.from(config.githubAttesterOracle.collectionIdFirst);
const collectionIdLast = BigNumber.from(config.githubAttesterOracle.collectionIdLast);

describe('Test Github attester contract', () => {
  let chainId: number;

  // contracts
  let attestationsRegistry: AttestationsRegistry;
  let githubAttesterOracle: GithubAttesterOracle;
  let hydraS1SimpleAttester: HydraS1SimpleAttester;
  let availableRootsRegistry: AvailableRootsRegistry;
  let commitmentMapperRegistry: CommitmentMapperRegistry;
  let badges: Badges;
  let roles: { admin: string; attester_oracle: string };

  // hydra s1 prover
  let prover: HydraS1Prover;
  let commitmentMapper: CommitmentMapperTester;
  let commitmentMapperPubKey: EddsaPublicKey;

  let registryTree: KVMerkleTree;

  // Test Signers
  let deployer: SignerWithAddress;
  let randomSigner: SignerWithAddress;
  let proxyAdminSigner: SignerWithAddress;
  let attesterOracle: SignerWithAddress;

  // Test accounts
  let source1: GithubAccountData;
  let destination1: GithubAccountData;
  let destination2: GithubAccountData;

  // Data source test
  let source1Value: number;
  let accountsTree1: KVMerkleTree;
  let accountsTree2: KVMerkleTree;
  let group1: GithubGroup;
  let group2: GithubGroup;

  // Valid request and proof
  let request: RequestStruct;
  let proof: SnarkProof;
  let ticketIdentifier: BigNumber;

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, randomSigner, proxyAdminSigner, attesterOracle] = signers;
    // chainId = parseInt(await hre.getChainId());

    // 1 - Init commitment mapper
    // commitmentMapper = await CommitmentMapperTester.generate();
    // commitmentMapperPubKey = await commitmentMapper.getPubKey();

    // 2 - Generate Accounts
    let accounts: GithubAccountData[] = await generateGithubAccounts(signers);

    source1 = accounts[0];
    destination1 = accounts[1];
    destination2 = accounts[3];

    // 3 - Generate data source
    const allList = await generateGithubLists(accounts);
    const { groups } = await generateGithubAttesterGroups(allList);

    group1 = groups[0];
    group2 = groups[1];
    source1Value = group1.data[source1.identifier];

    // 4 - Init Proving scheme
    // prover = new HydraS1Prover(registryTree, commitmentMapperPubKey);
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/

  describe('Deployments', () => {
    it('Should deploy and setup core', async () => {
      ({
        attestationsRegistry,
        badges,
        commitmentMapperRegistry,
        hydraS1SimpleAttester,
        availableRootsRegistry,
        githubAttesterOracle,
      } = (await hre.run('0-deploy-core-and-hydra-s1-simple-and-soulbound', {
        options: { log: false },
      })) as Deployed0);
      // const root = registryTree.getRoot();
      // await availableRootsRegistry.registerRootForAttester(hydraS1SimpleAttester.address, root);
      roles = {
        admin: await githubAttesterOracle.DEFAULT_ADMIN_ROLE(),
        attester_oracle: await githubAttesterOracle.ATTESTER_ORACLE_ROLE(),
      };

      expect(await githubAttesterOracle.hasRole(roles.admin, deployer.address)).to.be.true;
    });
  });

  /*************************************************************************************/
  /***************************** Emit Verify Request Event ****************************/
  /*************************************************************************************/

  describe('Verify Request event callback', () => {
    it('Should emit VerifyRequest event', async () => {
      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value,
            extraData: encodeGithubGroupProperties(group1.properties),
          },
        ],
        destination: BigNumber.from(destination1.account).toHexString(),
      };
      const tx = await githubAttesterOracle.requestVerifyRequestCallback(request);
      const { events } = await tx.wait();
      expect(events && events[0].event).to.equal('VerifyRequest');
      expect(events && events[0].args?.[1]).to.equal(deployer.address);
    });
  });

  /*************************************************************************************/
  /***************************** GENERATE VALID ATTESTATION ****************************/
  /*************************************************************************************/

  describe('Generate valid attestation', () => {
    it('Should revert due to the caller not being the attester oracle', async () => {
      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value,
            extraData: encodeGithubGroupProperties(group1.properties),
          },
        ],
        destination: BigNumber.from(destination1.account).toHexString(),
      };
      const tx = await githubAttesterOracle.requestVerifyRequestCallback(request);
      await expect(githubAttesterOracle.generateAttestations(request, '0x')).to.be.revertedWith(
        `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${
          roles.attester_oracle
        }`
      );
    });
    it('Should allow attester oracle to generate attestation', async () => {
      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value,
            extraData: encodeGithubGroupProperties(group1.properties),
          },
        ],
        destination: BigNumber.from(destination1.account).toHexString(),
      };
      console.log(
        'Deployer address: ',
        deployer.address,
        await githubAttesterOracle.getAttestationRegistry()
      );
      await githubAttesterOracle.grantRole(roles.attester_oracle, attesterOracle.address);
      await githubAttesterOracle.requestVerifyRequestCallback(request);
      const tx = await githubAttesterOracle
        .connect(attesterOracle)
        .generateAttestations(request, '0x');
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationGenerated');

      expect(args.attestation.issuer).to.equal(githubAttesterOracle.address);
      expect(args.attestation.owner).to.equal(BigNumber.from(destination1.account).toHexString());
      expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(0));
      expect(args.attestation.value).to.equal(1);
      expect(args.attestation.timestamp).to.equal(group1.properties.generationTimestamp);
    });
    // it('Should generate a proof with a Hydra S1 prover and verify it onchain using the attester', async () => {
    //   ticketIdentifier = await generateTicketIdentifier(
    //     hydraS1SimpleAttester.address,
    //     group1.properties.groupIndex
    //   );

    //   request = {
    //     claims: [
    //       {
    //         groupId: group1.id,
    //         claimedValue: source1Value,
    //         extraData: encodeGroupProperties(group1.properties),
    //       },
    //     ],
    //     destination: BigNumber.from(destination1.identifier).toHexString(),
    //   };

    //   proof = await prover.generateSnarkProof({
    //     source: source1,
    //     destination: destination1,
    //     claimedValue: source1Value,
    //     chainId: chainId,
    //     accountsTree: accountsTree1,
    //     ticketIdentifier: ticketIdentifier,
    //     isStrict: !group1.properties.isScore,
    //   });

    //   const tx = await hydraS1SimpleAttester.generateAttestations(request, proof.toBytes());
    //   const { events } = await tx.wait();
    //   const args = getEventArgs(events, 'AttestationGenerated');

    //   expect(args.attestation.issuer).to.equal(hydraS1SimpleAttester.address);
    //   expect(args.attestation.owner).to.equal(
    //     BigNumber.from(destination1.identifier).toHexString()
    //   );
    //   expect(args.attestation.collectionId).to.equal(
    //     collectionIdFirst.add(group1.properties.groupIndex)
    //   );
    //   expect(args.attestation.value).to.equal(0);
    //   expect(args.attestation.timestamp).to.equal(group1.properties.generationTimestamp);
    // });
  });

  /*************************************************************************************/
  /********************************* VERIFY REQUEST ************************************/
  /*************************************************************************************/

  // describe('Verify request', () => {
  //   /****************************************/
  //   /************* _validateInput() *********/
  //   /****************************************/

  //   it('Should revert due to accountsTree different from the request', async () => {
  //     const wrongProof = await prover.generateSnarkProof({
  //       source: source1,
  //       destination: destination2,
  //       claimedValue: source1Value,
  //       chainId: chainId,
  //       accountsTree: accountsTree2,
  //       ticketIdentifier: ticketIdentifier,
  //       isStrict: false,
  //     });

  //     await expect(
  //       hydraS1SimpleAttester.generateAttestations(request, wrongProof.toBytes())
  //     ).to.be.revertedWith(
  //       `AccountsTreeValueMismatch(${BigNumber.from(group1.id).toString()}, ${BigNumber.from(
  //         group2.id
  //       ).toString()})`
  //     );
  //   });

  //   it('Should revert due wrong request: user provided wrong group index property', async () => {
  //     const wrongRequest = { ...request, claims: [{ ...request.claims[0] }] };
  //     const wrongGroupProperties = { ...group1.properties };

  //     wrongGroupProperties.groupIndex = group2.properties.groupIndex;
  //     const wrongEncodedProperties = encodeGroupProperties(wrongGroupProperties);
  //     wrongRequest.claims[0].extraData = wrongEncodedProperties;
  //     await expect(
  //       hydraS1SimpleAttester.generateAttestations(wrongRequest, proof.toBytes())
  //     ).to.be.revertedWith(
  //       `GroupIdAndPropertiesMismatch(${BigNumber.from(
  //         generateGroupIdFromEncodedProperties(wrongEncodedProperties)
  //       ).toString()}, ${BigNumber.from(group1.id)})`
  //     );
  //   });

  //   it('Should revert due wrong request: user provided wrong generation timestamp property', async () => {
  //     const wrongRequest = { ...request, claims: [{ ...request.claims[0] }] };
  //     const wrongGroupProperties = { ...group1.properties };

  //     wrongGroupProperties.generationTimestamp = group2.properties.generationTimestamp;
  //     const wrongEncodedProperties = encodeGroupProperties(wrongGroupProperties);
  //     wrongRequest.claims[0].extraData = wrongEncodedProperties;
  //     await expect(
  //       hydraS1SimpleAttester.generateAttestations(wrongRequest, proof.toBytes())
  //     ).to.be.revertedWith(
  //       `GroupIdAndPropertiesMismatch(${BigNumber.from(
  //         generateGroupIdFromEncodedProperties(wrongEncodedProperties)
  //       ).toString()}, ${BigNumber.from(group1.id)})`
  //     );
  //   });

  //   it('Should revert due wrong request: user provided wrong isScore property', async () => {
  //     const wrongRequest = { ...request, claims: [{ ...request.claims[0] }] };
  //     const wrongGroupProperties = { ...group1.properties };

  //     wrongGroupProperties.isScore = !group1.properties.isScore;
  //     const wrongEncodedProperties = encodeGroupProperties(wrongGroupProperties);
  //     wrongRequest.claims[0].extraData = wrongEncodedProperties;
  //     await expect(
  //       hydraS1SimpleAttester.generateAttestations(wrongRequest, proof.toBytes())
  //     ).to.be.revertedWith(
  //       `GroupIdAndPropertiesMismatch(${BigNumber.from(
  //         generateGroupIdFromEncodedProperties(wrongEncodedProperties)
  //       ).toString()}, ${BigNumber.from(group1.id)})`
  //     );
  //   });

  //   it('Should revert due wrong request: groupId does not correspond to provided properties in extraData', async () => {
  //     const wrongRequest = { ...request, claims: [{ ...request.claims[0] }] };
  //     const wrongGroupId = generateGroupIdFromProperties({ ...group2.properties });
  //     wrongRequest.claims[0].groupId = wrongGroupId;

  //     await expect(
  //       hydraS1SimpleAttester.generateAttestations(wrongRequest, proof.toBytes())
  //     ).to.be.revertedWith(
  //       `GroupIdAndPropertiesMismatch(${BigNumber.from(group1.id).toString()}, ${wrongGroupId})`
  //     );
  //   });

  //   it('Should revert due to input proof destination not the same as destination', async () => {
  //     const wrongProof = await prover.generateSnarkProof({
  //       source: source1,
  //       destination: destination2,
  //       claimedValue: source1Value,
  //       chainId: chainId,
  //       accountsTree: accountsTree1,
  //       ticketIdentifier: ticketIdentifier,
  //       isStrict: !group1.properties.isScore,
  //     });

  //     await expect(
  //       hydraS1SimpleAttester.generateAttestations(request, wrongProof.toBytes())
  //     ).to.be.revertedWith(
  //       `DestinationMismatch("${BigNumber.from(
  //         destination1.identifier
  //       ).toHexString()}", "${BigNumber.from(destination2.identifier).toHexString()}")`
  //     );
  //   });

  //   it('Should revert due to chain id mismatch', async () => {
  //     const wrongProof = { ...proof, input: [...proof.input] };
  //     wrongProof.input[1] = BigNumber.from(123);
  //     const proofBytes = toBytes(wrongProof);

  //     await expect(
  //       hydraS1SimpleAttester.generateAttestations(request, proofBytes)
  //     ).to.be.revertedWith(`ChainIdMismatch(${parseInt(await hre.getChainId())}, 123)`);
  //   });

  //   it('Should revert due to input value not the same as claimValue', async () => {
  //     const requestWrong = { ...request, claims: [{ ...request.claims[0] }] };
  //     const wrongClaimValue = 1000;
  //     requestWrong.claims[0].claimedValue = wrongClaimValue;
  //     await expect(
  //       hydraS1SimpleAttester.generateAttestations(requestWrong, proof.toBytes())
  //     ).to.be.revertedWith(`ValueMismatch(${wrongClaimValue}, ${request.claims[0].claimedValue})`);
  //   });

  //   it('Should revert due to registry roots mismatch', async () => {
  //     const wrongProof = { ...proof, input: [...proof.input] };
  //     wrongProof.input[4] = BigNumber.from(123);
  //     const proofBytes = toBytes(wrongProof);

  //     await expect(
  //       hydraS1SimpleAttester.generateAttestations(request, proofBytes)
  //     ).to.be.revertedWith(`RegistryRootMismatch(123)`);
  //   });

  //   it('Should revert due to commitment mapper public key mismatch', async () => {
  //     // override the approver publicKey with a bad one
  //     const wrongProof = { ...proof, input: [...proof.input] };
  //     wrongProof.input[2] = BigNumber.from(123);
  //     const proofBytes = toBytes(wrongProof);

  //     await expect(
  //       hydraS1SimpleAttester.generateAttestations(request, proofBytes)
  //     ).to.be.revertedWith(
  //       `CommitmentMapperPubKeyMismatch(${commitmentMapperPubKey[0].toString()}, ${commitmentMapperPubKey[1].toString()}, 123, ${
  //         wrongProof.input[3]
  //       })`
  //     );
  //   });

  //   it('Should revert due to wrong ticket identifier', async () => {
  //     const wrongTicketIdentifier = 123;

  //     const proof2 = await prover.generateSnarkProof({
  //       source: source1,
  //       destination: destination1,
  //       claimedValue: source1Value,
  //       chainId: chainId,
  //       accountsTree: accountsTree1,
  //       ticketIdentifier: wrongTicketIdentifier,
  //       isStrict: !group1.properties.isScore,
  //     });

  //     await expect(
  //       hydraS1SimpleAttester.generateAttestations(request, proof2.toBytes())
  //     ).to.be.revertedWith(
  //       `TicketIdentifierMismatch(${ticketIdentifier}, ${wrongTicketIdentifier})`
  //     );
  //   });

  //   /****************************************/
  //   /************** _verifyProof() **********/
  //   /****************************************/

  //   it('Should not allow snark field overflow by providing a ticket that is outside the snark field', async () => {
  //     // override the ticket proof to overflow
  //     const wrongProof = { ...proof, input: [...proof.input] };
  //     wrongProof.input[6] = BigNumber.from(wrongProof.input[6]).add(SNARK_FIELD);

  //     const proofBytes = toBytes(wrongProof);

  //     await expect(
  //       hydraS1SimpleAttester.generateAttestations(request, proofBytes)
  //     ).to.be.revertedWith(`InvalidGroth16Proof("verifier-gte-snark-scalar-field")`);
  //   });
  //   it('Should revert if wrong snark proof', async () => {
  //     // override the ticket proof to overflow
  //     const wrongProof = { ...proof, a: [...proof.a] };
  //     wrongProof.a[0] = BigNumber.from(proof.a[0]).sub(1);

  //     const proofBytes = toBytes(wrongProof);

  //     await expect(
  //       hydraS1SimpleAttester.generateAttestations(request, proofBytes)
  //     ).to.be.revertedWith(`InvalidGroth16Proof("")`);
  //   });
  // });

  /*************************************************************************************/
  /************************** BEFORE RECORD ATTESTATION ********************************/
  /*************************************************************************************/

  // describe('Before record attestation', () => {
  //   it('Should revert due to nullifier hash having already been used', async () => {
  //     const wrongRequest = { ...request };
  //     wrongRequest.destination = BigNumber.from(destination2.identifier).toHexString();

  //     const proof2 = await prover.generateSnarkProof({
  //       source: source1,
  //       destination: destination2,
  //       claimedValue: source1Value,
  //       chainId: chainId,
  //       accountsTree: accountsTree1,
  //       ticketIdentifier: ticketIdentifier,
  //       isStrict: !group1.properties.isScore,
  //     });

  //     await expect(
  //       hydraS1SimpleAttester.generateAttestations(wrongRequest, proof2.toBytes())
  //     ).to.be.revertedWith(`TicketUsed(${proof.input[6]})`);
  //   });
  // });
});
