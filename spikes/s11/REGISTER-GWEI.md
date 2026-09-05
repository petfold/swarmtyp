# Registering swarmtyp.gwei and pointing it at the S11 site

Everything you need to paste is in this file. Open it in an editor or browser and copy from there.

## Values

Site address to use as the name's website (the feed manifest; never needs changing when we publish updates):

    bzz://fff4e38ecaeb5253c1c7eae0e24daf655cc9ae995df806e507af0094de072910

Registrar contract that MetaMask should show as the recipient of the registration transaction (Ethereum mainnet):

    0xc1D5245bfd98dDB7E73B33209B346b4FC0E03f3c

Name NFT contract (for checking the minted name later):

    0x9D51…81d6  (full address is shown in the gwei-names README: https://github.com/lucadonnoh/gwei-names)

Site to type into Brave's address bar yourself (not from a link):

    https://gwei.domains

Suggested name (8 characters, cheapest tier, 0.0005 ETH plus gas):

    swarmtyp

## Before you start

1. MetaMask on Ethereum mainnet, with a little more than 0.0005 ETH plus gas for two transactions.
2. Type https://gwei.domains into the address bar yourself.
3. Decide whether this name is for the app later or only for the test site. The name is permanent; what it points at can be changed with another transaction at any time.

## Register

4. Connect MetaMask when the site asks. Approve only the wallet connection.
5. Search for `swarmtyp` and confirm it is available.
6. Check the price shown: 0.0005 ETH for this name. The fee is burned and a registration cannot be undone.
7. Confirm the registration transaction in MetaMask. Compare the recipient address with the registrar contract above. Wait for confirmation.

## Point it at the site

8. On gwei.domains, open your name and choose "Set Website".
9. Paste the bzz:// value from the top of this file.
10. Confirm the second transaction in MetaMask.

## Then

Tell Claude the name. It will check https://swarmtyp.gwei.domains/ in a normal browser and bzz://swarmtyp.gwei/ in Freedom Browser, time how long an update takes to appear (their gateway caches for 5 minutes), and fill in the last row of the S11 table in docs/spikes.md.
