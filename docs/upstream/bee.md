# Upstream issues for Bee

## 1. Name resolution for registry-less name services (`.gwei`)

Filed: https://github.com/ethersphere/bee/issues/5600 (2026-09-05). Draft PR: https://github.com/ethersphere/bee/pull/5601 (branch `feat/resolver-profile-contracts` on `petfold/bee`; `wrapDial` falls back to an EIP-165 probe for 0xbc1c58d1, `Resolve` then reads `contenthash` through `goens.NewResolverAt`; unit tests; live check resolved `swarmtyp.gwei` to the release manifest in 1.2 s on a public mainnet RPC).

Bee's ENS client (`pkg/resolver/client/ens/ens.go`) calls `owner` and `resolver` on the configured contract before `contenthash`; GNS's `NameNFT` (`0x9D51D507BC7264d4fE8Ad1cf7Fe191933A0a81d6`) implements the resolver profile directly (`contenthash(bytes32 node)`, `addr`, `text`, `supportsInterface(0xbc1c58d1)`) with EIP-137 nodes and no registry. Proposed: detect the profile when the registry probe fails and use `goens.NewResolverAt(ethCl, name, addr).Contenthash()`; or an explicit `resolver=` marker in `resolver-options`. Test name: `swarmtyp.gwei` → `b656fac5…a100`. Once merged, the guide gets `http://127.0.0.1:1633/bzz/swarmtyp.gwei/` and Swarm Desktop users can use the name.
