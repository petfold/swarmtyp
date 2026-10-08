# S13: storage for the S13 Freedom profile (record)

Bought 2026-10-08 for spike S13, on the owner's instruction.

- **Profile:** `/home/test/freedom-s13/devhome`, Freedom from `../freedom-browser` at 20152029 with Ant 0.5.61. Keep this folder: its node wallet owns the batch.
- **Node wallet:** `0xc555a6efc44fae25e5a5755301f957a7f82d5c16` (Gnosis Chain).
- **Plan:** Starter, an immutable depth-20 batch (about 688 MB) for 30 days, confirmed 18:43 UTC.
- **Chequebook:** `0x8db3f712aa85dfe9a93a591b86da4199d3fdf0d8`, deposit 0.001 xBZZ.

## What happened

1. **Funding, 18:39 UTC.** 0.45 xDAI from Swarm Desktop's node wallet (`0xbd93168814b2786bcaf8783d3ca2348bf193ccfd`) through Bee's withdrawal endpoint. Freedom's node wallet was put on Swarm Desktop's withdrawal whitelist for this (the owner approved it and restarted Swarm Desktop), and taken off again afterwards. Transaction `0x3a5a956e7ac63ba6155869a9de97f7bed1ce749fb157141078f53f59899737fc`, block 48,656,188.
2. **Swap, then a false failure, 18:40 UTC.** Freedom's node swapped the xDAI for xBZZ: transaction `0x49be1193704849a9abcc2162a439d4d911f8d55c3b9e7a14be6766a086472e85`, block 48,656,190, successful. Freedom then looked up the receipt before the next block existed. Its chain RPC answered "The Block after 48656190, which should contain the parentBeaconBlockRoot for the data block can not be found in the execution layer!", and Freedom marked the whole purchase failed although the swap had gone through. Worth reporting to Freedom: that error is transient and should be retried, not treated as failure.
3. **Purchase, 18:42–18:43 UTC.** Re-arming the same plan used the 8.74 xBZZ already in the wallet: no more xDAI was needed. Freedom deployed the chequebook, bought the batch, and the batch was usable a minute later.

Left in the node wallet afterwards: about 0.37 xBZZ and 0.04 xDAI.
