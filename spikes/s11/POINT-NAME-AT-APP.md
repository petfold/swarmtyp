# swarmtyp.gwei: pointing the name at the editor (D-25)

Everything to paste is in this file; copy from here, not from the terminal. Three short sessions with MetaMask
in Brave, each one or two transactions, gas only (subdomains have no fee). Do them in this order.

## Values

Release feed manifest of the editor (follows every `pnpm release`; this is what the app names point at):

    bzz://b656fac57eb02756af40279cf70275969c9f9219818af7cceee34101f169a100

Feed manifest of the S11 sample site (what swarmtyp.gwei points at today):

    bzz://fff4e38ecaeb5253c1c7eae0e24daf655cc9ae995df806e507af0094de072910

Site to type into Brave's address bar yourself:

    https://gwei.domains

GNS NameNFT contract, which MetaMask should show as the recipient of every transaction below (Ethereum mainnet;
subdomain minting and website records both live in this contract):

    0x9D51D507BC7264d4fE8Ad1cf7Fe191933A0a81d6

## General rules for each transaction

- MetaMask on Ethereum mainnet, the account that owns swarmtyp.gwei, enough ETH for gas (a few transactions).
- Open gwei.domains by typing it. Connect the wallet when asked; approve the connection only.
- Before confirming in MetaMask, compare the recipient address with the contract above. If it differs, cancel and tell Claude.
- The UI labels below come from the GNS guide ("Set Website") and its README ("registerSubdomain"); button texts on the
  site may differ slightly. If a step does not match what you see, stop and describe the screen.
- After each session, tell Claude what you did; it verifies before you continue.

## Session 1: test the editor on a subdomain (one or two transactions)

Why first: the gateway serves whole files without Range support and the editor loads 12 MB plus a worker and fonts.
That has not been tried through gwei.domains. A subdomain lets us test without touching the root.

1. On gwei.domains, open your names and select swarmtyp.gwei.
2. Find the subdomain section (README: `registerSubdomain(label, parentId)`). Create the label

       app

   Confirm the transaction in MetaMask. The result is a new name, app.swarmtyp.gwei, owned by the same wallet.
3. Open app.swarmtyp.gwei and choose "Set Website". Paste the release feed manifest:

       bzz://b656fac57eb02756af40279cf70275969c9f9219818af7cceee34101f169a100

   Confirm the transaction. (If the UI lets you set the website while creating the subdomain, one transaction is enough.)
4. Tell Claude. It checks https://app.swarmtyp.gwei.domains/ (load time, compile, fonts, sharing) in Chromium and
   bzz://app.swarmtyp.gwei/ in Freedom, and records the result in docs/spikes.md.

## Session 2: move the root to the editor (one transaction)

Only after Session 1 is confirmed to work.

5. Open swarmtyp.gwei (the root) and choose "Set Website". Replace the current value with the release feed manifest:

       bzz://b656fac57eb02756af40279cf70275969c9f9219818af7cceee34101f169a100

   Confirm. Within about five minutes https://swarmtyp.gwei.domains/ opens the editor; Freedom sees it at once.
6. Tell Claude. It updates the user guide and CLAUDE.md so the stable address is written as swarmtyp.gwei everywhere.

## Session 3: swarmtyp's own pages as subdomains (two transactions each, or one if combined)

7. Subdomain `demo` → the S11 sample site, so it keeps a home after the root moves:

       label:   demo
       website: bzz://fff4e38ecaeb5253c1c7eae0e24daf655cc9ae995df806e507af0094de072910

8. Subdomain `guide` → the user guide, once Claude has published it as a paged site. Claude will put the value in this
   file when it exists; create the subdomain then, or create it now and set the website later.

## What you never need to do again

Releases: `pnpm release` writes a new feed update; the names follow it. Rollback: an older reference written as the
newest update. The only reasons to touch a name again are a lost feed key (`SWARMTYP_FEED_KEY` in `.env.local`,
never committed) or a decision to point a subdomain elsewhere.

## If something goes wrong

- MetaMask shows a different recipient contract: cancel, tell Claude.
- A transaction fails or the UI errors after confirming: nothing was charged beyond gas; wait a minute, reload, look
  at the name's current records before retrying so nothing is set twice.
- The site shows "not found" for a name right after setting it: the gateway caches for five minutes; Freedom does not.
