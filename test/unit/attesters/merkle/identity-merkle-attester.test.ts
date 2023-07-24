// import { expect } from 'chai';
// import hre, { ethers } from 'hardhat';
// import {
//   AttestationsRegistry,
//   AvailableRootsRegistry,
//   Badges,
//   IdentityMerkleAttester,
//   SignatureAttester,
// } from 'types';
// import { RequestStruct } from 'types/Attester';

// import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
// import { BigNumber, utils } from 'ethers';
// import { Deployed0 } from 'tasks/deploy-tasks/full/0-deploy-core-and-hydra-s1-simple-and-soulbound.task';
// import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';
// import {
//   generateIdentityMerkleAccounts,
//   IdentityMerkleData,
//   generateIdentityMerkleLists,
//   generateIdentityMerkleAttesterGroups,
//   IdentityMerkleGroup,
//   encodeIdentityMerkleGroupProperties,
//   encodeIdentityMerkleProofData,
//   getEventArgs,
//   encodeSignatureGroupProperties,
//   generateEIP712TypedSignData,
//   SignatureAttesterDomainName,
//   SignatureAccountData,
//   generateSignatureAccounts,
//   generateSignatureLists,
//   generateSignatureAttesterGroups,
//   encodeIdentityBadgeData,
// } from '../../../utils';
// import { keccak256, KVMerkleTree } from '@sismo-core/hydra-s1';
// import MerkleTree from 'merkletreejs';

// const config = deploymentsConfig[hre.network.name];
// const collectionIdFirst = BigNumber.from(config.identityMerkleAttester.collectionIdFirst);
// const collectionIdLast = BigNumber.from(config.identityMerkleAttester.collectionIdLast);

// describe('Test Identity Merkle attester contract', () => {
//   let chainId: number;

//   // contracts
//   let attestationsRegistry: AttestationsRegistry;
//   let availableRootsRegistry: AvailableRootsRegistry;
//   let signatureAttester: SignatureAttester;
//   let identityMerkleAttester: IdentityMerkleAttester;
//   let badges: Badges;

//   // Merkle tree
//   let registryTree: MerkleTree;

//   // Test Signers
//   let signers: SignerWithAddress[];
//   let deployer: SignerWithAddress;
//   let randomSigner: SignerWithAddress;
//   let proxyAdminSigner: SignerWithAddress;
//   let attesterOracle: SignerWithAddress;

//   // Test accounts
//   let source1: IdentityMerkleData;
//   let source2: IdentityMerkleData;
//   let destination1: SignerWithAddress;
//   let destination2: SignerWithAddress;

//   // Data source test
//   let source1Value: BigNumber;
//   let accountsTree1: MerkleTree;
//   let accountsTree2: MerkleTree;
//   let group1: IdentityMerkleGroup;
//   let group2: IdentityMerkleGroup;
//   let root: string;
//   let identityAttestationId: BigNumber;

//   // Valid request and proof
//   let request: RequestStruct;

//   before(async () => {
//     signers = await hre.ethers.getSigners();
//     [deployer, randomSigner, proxyAdminSigner, attesterOracle, destination1, destination2] =
//       signers;

//     let accounts: IdentityMerkleData[] = await generateIdentityMerkleAccounts(signers);

//     source1 = accounts[0];
//     source2 = accounts[1];

//     // Generate data source
//     const allList = await generateIdentityMerkleLists(accounts);
//     const { dataFormat, groups } = await generateIdentityMerkleAttesterGroups(allList);

//     registryTree = dataFormat.registryTree;
//     accountsTree1 = dataFormat.accountsTrees[0];
//     accountsTree2 = dataFormat.accountsTrees[1];
//     group1 = groups[0];
//     group2 = groups[1];
//     source1Value = BigNumber.from(allList[0][source1.identifier]); // accountsTree1.getValue(BigNumber.from(source1.identifier).toHexString());
//   });

//   /*************************************************************************************/
//   /********************************** DEPLOYMENTS **************************************/
//   /*************************************************************************************/

//   describe('Deployments', () => {
//     it('Should deploy and setup core', async () => {
//       ({
//         attestationsRegistry,
//         badges,
//         signatureAttester,
//         identityMerkleAttester,
//         availableRootsRegistry,
//       } = (await hre.run('0-deploy-core-and-signature-and-skill-and-identity-merkle', {
//         options: { log: false },
//       })) as Deployed0);
//       root = accountsTree1.getHexRoot();
//       await availableRootsRegistry.registerRootForAttester(identityMerkleAttester.address, root);
//       expect(
//         await availableRootsRegistry.isRootAvailableForAttester(
//           identityMerkleAttester.address,
//           root
//         )
//       ).to.equal(true);
//     });
//     it('Should generate identity attestations', async () => {
//       const deadline = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

//       let accounts: SignatureAccountData[] = await generateSignatureAccounts(signers);

//       const allList = await generateSignatureLists(accounts);
//       const { groups } = await generateSignatureAttesterGroups(allList);

//       let badgeData = encodeIdentityBadgeData({ ...accounts[2], identifier: source1.identifier });
//       groups[2].properties.badgeData = badgeData;
//       const request = {
//         claims: [
//           {
//             groupId: groups[2].id,
//             claimedValue: 1,
//             extraData: encodeSignatureGroupProperties(groups[2].properties),
//           },
//         ],
//         destination: deployer.address,
//       };

//       const signData = generateEIP712TypedSignData(
//         request,
//         signatureAttester.address,
//         deadline,
//         SignatureAttesterDomainName
//       );
//       const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
//       const { r, s, v } = utils.splitSignature(sig);
//       const data = ethers.utils.defaultAbiCoder.encode(
//         ['uint8', 'bytes32', 'bytes32', 'uint256'],
//         [v, r, s, deadline]
//       );
//       const tx = await signatureAttester.generateAttestations(request, data);
//       const { events } = await tx.wait();
//       const args = getEventArgs(events, 'AttestationGenerated');
//       identityAttestationId = args.attestation.collectionId;

//       expect(args.attestation.issuer).to.equal(signatureAttester.address);
//       expect(args.attestation.owner).to.equal(BigNumber.from(deployer.address).toHexString());
//       expect(args.attestation.value).to.equal(1);
//       expect(args.attestation.extraData).to.equal(request.claims[0].extraData);

//       // 2nd Identity Attestation
//       badgeData = encodeIdentityBadgeData({ ...accounts[3], identifier: source2.identifier });
//       groups[3].properties.badgeData = badgeData;
//       const request2 = {
//         claims: [
//           {
//             groupId: groups[3].id,
//             claimedValue: 1,
//             extraData: encodeSignatureGroupProperties(groups[3].properties),
//           },
//         ],
//         destination: deployer.address,
//       };

//       const signData2 = generateEIP712TypedSignData(
//         request2,
//         signatureAttester.address,
//         deadline,
//         SignatureAttesterDomainName
//       );
//       const sig2 = await deployer._signTypedData(
//         signData2.domain,
//         signData2.types,
//         signData2.message
//       );
//       const splitSig = utils.splitSignature(sig2);
//       const data2 = ethers.utils.defaultAbiCoder.encode(
//         ['uint8', 'bytes32', 'bytes32', 'uint256'],
//         [splitSig.v, splitSig.r, splitSig.s, deadline]
//       );
//       await (await signatureAttester.generateAttestations(request2, data2)).wait();

//       // 3rd Identity Attestation
//       // badgeData = encodeIdentityBadgeData({...accounts[4], identifier: source2.identifier});
//       // groups[4].properties.badgeData = badgeData;
//       const request3 = {
//         claims: [
//           {
//             groupId: groups[4].id,
//             claimedValue: 1,
//             extraData: encodeSignatureGroupProperties(groups[4].properties),
//           },
//         ],
//         destination: deployer.address,
//       };

//       const signData3 = generateEIP712TypedSignData(
//         request3,
//         signatureAttester.address,
//         deadline,
//         SignatureAttesterDomainName
//       );
//       const sig3 = await deployer._signTypedData(
//         signData3.domain,
//         signData3.types,
//         signData3.message
//       );
//       const splitSig3 = utils.splitSignature(sig3);
//       const data3 = ethers.utils.defaultAbiCoder.encode(
//         ['uint8', 'bytes32', 'bytes32', 'uint256'],
//         [splitSig3.v, splitSig3.r, splitSig3.s, deadline]
//       );
//       await (await signatureAttester.generateAttestations(request3, data3)).wait();
//     });
//   });

//   /*************************************************************************************/
//   /***************************** GENERATE VALID ATTESTATION ****************************/
//   /*************************************************************************************/

//   describe('Generate valid attestation', () => {
//     it('Should generate attestation', async () => {
//       request = {
//         claims: [
//           {
//             groupId: root,
//             claimedValue: source1Value,
//             extraData: encodeIdentityMerkleGroupProperties(group1.properties, source1.identifier),
//           },
//         ],
//         destination: deployer.address,
//       };

//       const path = accountsTree1.getHexProof(
//         ethers.utils.keccak256(
//           ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
//         )
//       );
//       const data = encodeIdentityMerkleProofData(path, source1.identifier, identityAttestationId);
//       const tx = await identityMerkleAttester.generateAttestations(request, data);
//       const { events } = await tx.wait();
//       const args = getEventArgs(events, 'AttestationGenerated');

//       expect(args.attestation.issuer).to.equal(identityMerkleAttester.address);
//       expect(args.attestation.owner).to.equal(BigNumber.from(deployer.address).toHexString());
//       expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(0));
//       expect(args.attestation.value).to.equal(1);
//       expect(args.attestation.timestamp).to.equal(group1.properties.generationTimestamp);
//     });

//     it('Should update existing attestation', async () => {
//       request = {
//         claims: [
//           {
//             groupId: root,
//             claimedValue: source1Value,
//             extraData: encodeIdentityMerkleGroupProperties(group1.properties, source1.identifier),
//           },
//         ],
//         destination: deployer.address,
//       };

//       const path = accountsTree1.getHexProof(
//         ethers.utils.keccak256(
//           ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
//         )
//       );
//       const data = encodeIdentityMerkleProofData(path, source1.identifier, identityAttestationId);
//       const tx = await identityMerkleAttester.generateAttestations(request, data);
//       const { events } = await tx.wait();
//       const args = getEventArgs(events, 'AttestationGenerated');

//       expect(args.attestation.issuer).to.equal(identityMerkleAttester.address);
//       expect(args.attestation.owner).to.equal(BigNumber.from(deployer.address).toHexString());
//       expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(0));
//       expect(args.attestation.value).to.equal(1);
//       expect(args.attestation.timestamp).to.equal(group1.properties.generationTimestamp);
//     });
//   });

//   /*************************************************************************************/
//   /********************************* VERIFY REQUEST ************************************/
//   /*************************************************************************************/

//   describe('Verify request', () => {
//     /****************************************/
//     /************* _validateInput() *********/
//     /****************************************/
//     it('Should revert due to invalid root', async () => {
//       const invalidRoot = accountsTree2.getHexRoot();
//       request = {
//         claims: [
//           {
//             groupId: invalidRoot,
//             claimedValue: source1Value,
//             extraData: encodeIdentityMerkleGroupProperties(group2.properties, source1.identifier),
//           },
//         ],
//         destination: deployer.address,
//       };

//       const path = accountsTree2.getHexProof(
//         ethers.utils.keccak256(
//           ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
//         )
//       );
//       const data = encodeIdentityMerkleProofData(path, source1.identifier, identityAttestationId);
//       await expect(
//         identityMerkleAttester.generateAttestations(request, data)
//       ).to.be.revertedWithCustomError(identityMerkleAttester, 'GroupNotAvailable');
//     });
//     /****************************************/
//     /************** _verifyProof() **********/
//     /****************************************/
//     it('Should revert due to invalid claim', async () => {
//       request = {
//         claims: [
//           {
//             groupId: root,
//             claimedValue: source1Value.add(1),
//             extraData: encodeIdentityMerkleGroupProperties(group1.properties, source1.identifier),
//           },
//         ],
//         destination: deployer.address,
//       };

//       const path = accountsTree1.getHexProof(
//         ethers.utils.keccak256(
//           ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
//         )
//       );
//       const data = encodeIdentityMerkleProofData(path, source1.identifier, identityAttestationId);
//       await expect(
//         identityMerkleAttester.generateAttestations(request, data)
//       ).to.be.revertedWithCustomError(identityMerkleAttester, 'ClaimInvalid');
//     });
//     it('Should revert due to invalid identity', async () => {
//       request = {
//         claims: [
//           {
//             groupId: root,
//             claimedValue: source1Value,
//             extraData: encodeIdentityMerkleGroupProperties(group1.properties, source1.identifier),
//           },
//         ],
//         destination: deployer.address,
//       };

//       const path = accountsTree1.getHexProof(
//         ethers.utils.keccak256(
//           ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
//         )
//       );
//       const data = encodeIdentityMerkleProofData(
//         path,
//         source1.identifier,
//         identityAttestationId.add(1)
//       );
//       await expect(
//         identityMerkleAttester.generateAttestations(request, data)
//       ).to.be.revertedWithCustomError(identityMerkleAttester, 'IdentityInvalid');
//     });
//     it('Should revert due to invalid badge', async () => {
//       request = {
//         claims: [
//           {
//             groupId: root,
//             claimedValue: source1Value,
//             extraData: encodeIdentityMerkleGroupProperties(group1.properties, source1.identifier),
//           },
//         ],
//         destination: deployer.address,
//       };

//       const path = accountsTree1.getHexProof(
//         ethers.utils.keccak256(
//           ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
//         )
//       );
//       const data = encodeIdentityMerkleProofData(
//         path,
//         source1.identifier,
//         identityAttestationId.add(2)
//       );
//       await expect(
//         identityMerkleAttester.generateAttestations(request, data)
//       ).to.be.revertedWithCustomError(identityMerkleAttester, 'BadgeInvalid');
//     });
//     it('Should revert due to unexisting identity', async () => {
//       request = {
//         claims: [
//           {
//             groupId: root,
//             claimedValue: source1Value,
//             extraData: encodeIdentityMerkleGroupProperties(group1.properties, source1.identifier),
//           },
//         ],
//         destination: deployer.address,
//       };

//       const path = accountsTree1.getHexProof(
//         ethers.utils.keccak256(
//           ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
//         )
//       );
//       const data = encodeIdentityMerkleProofData(
//         path,
//         source1.identifier,
//         identityAttestationId.add(3)
//       );
//       await expect(
//         identityMerkleAttester.generateAttestations(request, data)
//       ).to.be.revertedWithCustomError(identityMerkleAttester, 'IdentityDoesNotExist');
//     });
//   });
//   /*************************************************************************************/
//   /************************** BEFORE RECORD ATTESTATION ********************************/
//   /*************************************************************************************/
//   describe('Before record attestation', () => {
//     it('Should revert due to source having already been used', async () => {
//       request = {
//         claims: [
//           {
//             groupId: root,
//             claimedValue: source1Value,
//             extraData: encodeIdentityMerkleGroupProperties(group1.properties, source1.identifier),
//           },
//         ],
//         destination: destination2.address,
//       };

//       const path = accountsTree1.getHexProof(
//         ethers.utils.keccak256(
//           ethers.utils.solidityPack(['string', 'uint256'], [source1.identifier, source1Value])
//         )
//       );
//       const data = encodeIdentityMerkleProofData(path, source1.identifier, identityAttestationId);
//       await expect(identityMerkleAttester.generateAttestations(request, data))
//         .to.be.revertedWithCustomError(identityMerkleAttester, `SourceAlreadyUsed`)
//         .withArgs(deployer.address);
//     });
//   });

//   /*************************************************************************************/
//   /***************************** Delete ATTESTATION ****************************/
//   /*************************************************************************************/

//   describe('Delete attestation', () => {
//     it('Should revert delete attestation', async () => {
//       await expect(
//         identityMerkleAttester
//           .connect(randomSigner)
//           .deleteAttestations(
//             [collectionIdFirst.add(0), collectionIdFirst.add(1)],
//             deployer.address,
//             '0x'
//           )
//       )
//         .to.be.revertedWithCustomError(identityMerkleAttester, 'NotAttestationOwner')
//         .withArgs(collectionIdFirst.add(0), randomSigner.address);
//     });
//     it('Should delete attestation', async () => {
//       const tx = await identityMerkleAttester
//         // .connect(await ethers.getSigner(deployer.address))
//         .deleteAttestations([collectionIdFirst.add(0)], deployer.address, '0x');
//       const { events } = await tx.wait();
//       const args = getEventArgs(events, 'AttestationDeleted');

//       expect(args.attestation.issuer).to.equal(identityMerkleAttester.address);
//       expect(args.attestation.owner).to.equal(BigNumber.from(deployer.address).toHexString());
//       expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(0));
//       expect(args.attestation.value).to.equal(1);
//     });
//   });
// });
