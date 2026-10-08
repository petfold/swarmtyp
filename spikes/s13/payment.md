# S13: fund Freedom's node for the Starter storage plan

- **Network:** Gnosis Chain (chain id 100)
- **Token:** xDAI, the native coin of Gnosis Chain (not an ERC-20 token)
- **Send to** (the node wallet of the S13 Freedom profile): `0xc555a6efc44fae25e5a5755301f957a7f82d5c16`
- **Amount:** 0.43 xDAI. That is Freedom's quote at 2026-10-08 17:05 UTC; the node needs 0.4211. Sending 0.45 leaves room if the price moves; whatever is left stays in the node wallet for later top-ups.

What happens next, without anyone doing anything: Freedom checks the wallet every few seconds. Once it holds enough, the node swaps xDAI for xBZZ, buys an immutable depth-20 batch (about 688 MB) for 30 days, and puts 0.001 xBZZ into its chequebook. The batch shows as "Confirming" for about a minute, then it is usable and spike S13 can run.

Freedom is running from `../freedom-browser` (commit 20152029, Ant 0.5.61) with the purchase armed, for up to four hours from 17:05 UTC. Profile: `/home/test/freedom-s13/devhome`. Keep that folder: its node wallet owns the storage.

Other plans quoted at the same time: Advanced (depth 21, 180 days) 4.89 xDAI; Plus (depth 22, 365 days) 19.78 xDAI.
