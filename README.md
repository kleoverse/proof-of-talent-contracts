
<div class="callout-left wide">

🚨 Depreciated! 🚨

</div>

NOTE: This repository is for the v0 protocol contracts. Kindly refer to <a href="https://github.com/kleoverse/proof-of-talent"> current protocol contracts</a>.

---

<br />
<div align="center">
  <img src="docs/kleoverse-logo.png" alt="Logo" width="100" height="100" style="borderRadius: 20px">

  <h3 align="center">
    Proof of Talent Protocol
  </h3>
  
  <p align="center">
    Developed by <a href="https://www.kleoverse.com/" target="_blank">Kleoverse</a> crew
  </p>

  <p align="center">
    Built on top of <a href="https://www.sismo.io/" target="_blank">Sismo Protocol</a>
  </p>
  
  <p align="center">
    <a href="https://discord.com/invite/u9v97PJVMA" target="_blank">
        <img src="https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white"/>
    </a>
    <a href="https://twitter.com/kleoverse" target="_blank">
        <img src="https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white"/>
    </a>
  </p>
  <a href="https://www.sismo.io/" target="_blank">
    
  </a>
</div>
<br/>
This repository contains the smart contracts of the Proof Of Talent Protocol. The architecture is forked from Sismo Protocol. We have created new attesters and supporting skill badge contract.

See the whole documentation at https://proofoftalent.org.

There are three core contracts:

- `core/AttestationsRegistry.sol`: The registry stores all attestations. It is owned by the governance that authorize/unauthorize issuers to record in it
- `core/Attester.sol` The standard abstract contract must be inherited by attesters. Attesters are issuers of attestations. They verify user requests and build attestations that will be recorded in the registry
- `core/Badges.sol` Reads the registry. Stateless Non Transferable Token view of attestations (ERC1155)

Proof of talent attesters in `attesters/`:

- `SignatureAttester.sol`: Signature Attester verify via Ecrecover that the message was correctly signed by the address of the centralized service that verify the claim based on another centralised service API like github, discord
- `IdentityMerkleAttester.sol`: Identity Merkle Attester issues attestations to users with a userId of identity that's part of an identity accounts merkle tree
- `SkillAttester.sol`: Skill Attester issues attestations to users with based on skill points fetched from `SkillBadge.sol`

Badges:

- `periphery/badges/SkillBadge.sol`: Stores weights for Cred Badges from POT protocol and external ERC721/ERC1155 contracts for different skills to calculate skill points.

<br/><br/>

## Proof of Talent protocol

A complete overview of the protocol is available in Sismo's [documentation](https://protocol.docs.sismo.io)

## Deployed contracts

Deployed contracts can be found [here](https://proofoftalent.org/deployed-contracts)

## Usage

### Installation

```
yarn
```

### Compile contracts

Compile contracts using hardhat

```
yarn compile
```

### Test

Launch all tests

```
yarn test
```

### Print storage layout

```
yarn storage-layout
```

### Deploy on local chain

Terminal tab 1

```
yarn chain
```

Terminal tab 2

```
yarn deploy:local
```

## Create a new Attester

To develop a new attester, you must inherit the `core/Attester.sol` abstract contract and implement the following functions:

- `_verifyRequest(request, proofData)`: You must implement the user request verification against the proof provided by the user
- `buildAttestations(request, proofData)`: You must build the attestations that will be recorded from a verified user request

There are other optional hook functions that can be implemented:

- `_beforeRecordAttestations(request, proofData)`
- `_afterRecordAttestations(request, proofData)`

The `/attesters/hydra-s1/HydraS1SimpleAttester.sol` is a good example of an attester implementing those functions.

A [guide](https://attesters.docs.sismo.io) is offered in Sismo's documentation.

Feel free open a PR with your new attester in `/attester`!

## License

Distributed under the MIT License.

## Contribute

Please, feel free to open issues, PRs or simply provide feedback!

## Contact

Prefer [Discord](https://discord.com/invite/u9v97PJVMA) or [Twitter](https://twitter.com/kleoverse)
