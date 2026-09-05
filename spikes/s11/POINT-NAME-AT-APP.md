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

## How the gwei.domains page works (checked in your Brave on 2026-09-05)

There is no "my names" menu. The page has one big NAME field at the top ("yourname .gwei"). Typing a name you own
into it makes a "MANAGE NAME" panel appear further down, below the "verify name →" line. The panel shows OWNER,
RESOLVES TO, WEBSITE, EXPIRES, and eight buttons: TRANSFER, SET RECIPIENT, SET WEBSITE, SET TEXT, SUBDOMAIN,
SET AS DISPLAY NAME, SUBDOMAIN SALES, RENEW. Your wallet shows top right as 0xd5D8…75E3; if it does not, the panel
will not offer the actions.

Note the EXPIRES line: the name runs to 9/5/2027. Names are yearly; RENEW before then (put it in a calendar).

## General rules for each transaction

- MetaMask on Ethereum mainnet, the account shown top right, enough ETH for gas.
- Open gwei.domains by typing it into the address bar.
- Before confirming in MetaMask, compare the recipient address with the NameNFT contract above.
- After each session, tell Claude what you did; it verifies before you continue.

## Session 1: test the editor on a subdomain (two transactions) — DONE 2026-09-05

Result: bzz://app.swarmtyp.gwei/ works in Freedom; https://app.swarmtyp.gwei.domains/ has no TLS certificate (subdomains of a
name are one label too deep for the gateway's wildcard), http:// works. Conclusion: subdomains are Freedom-only; the root
is the web address.

Why first: the gateway serves whole files without Range support and the editor loads 12 MB plus a worker and fonts.
That has not been tried through gwei.domains. A subdomain lets us test without touching the root.

1. In the NAME field type `swarmtyp`. Scroll down to the MANAGE NAME panel.
2. Click SUBDOMAIN. A field "SUBDOMAIN LABEL" (placeholder "e.g. blog") appears with the preview "{label}.swarmtyp.gwei".
   Type

       app

   and click REGISTER SUBDOMAIN. Confirm in MetaMask. Wait for the confirmation.
3. In the NAME field, replace the text with

       app.swarmtyp

   so the MANAGE NAME panel shows app.swarmtyp.gwei (owner: you). If the panel does not switch, reload the page and
   type it again. Click SET WEBSITE, paste the release feed manifest:

       bzz://b656fac57eb02756af40279cf70275969c9f9219818af7cceee34101f169a100

   and confirm the transaction in MetaMask.
4. Tell Claude. It checks https://app.swarmtyp.gwei.domains/ (load time, compile, fonts, sharing) in Chromium and
   bzz://app.swarmtyp.gwei/ in Freedom, and records the result in docs/spikes.md.

## Session 2: move the root to the editor (one transaction) — DONE 2026-09-05

https://swarmtyp.gwei.domains/ opens the editor (tx 0x539863f7…2220). Nothing more to do here.

5. NAME field: `swarmtyp`. In MANAGE NAME click SET WEBSITE, replace the current value (the sample site) with

       bzz://b656fac57eb02756af40279cf70275969c9f9219818af7cceee34101f169a100

   and confirm. Within about five minutes https://swarmtyp.gwei.domains/ opens the editor; Freedom sees it at once.
6. Tell Claude. It updates the user guide and CLAUDE.md so the stable address is written as swarmtyp.gwei everywhere.

## Session 3: dropped (subdomains have no certificate on the web gateways)

The guide and the demo will live under paths of the root, swarmtyp.gwei/guide/ and swarmtyp.gwei/demo/, added by the
release tooling; no transactions needed. The rest of this section is kept for reference only.

### (old) Session 3: swarmtyp's own pages as subdomains

7. Subdomain `demo` (SUBDOMAIN → label `demo` → REGISTER SUBDOMAIN), then NAME field `demo.swarmtyp` → SET WEBSITE:

       bzz://fff4e38ecaeb5253c1c7eae0e24daf655cc9ae995df806e507af0094de072910

   so the S11 sample keeps a home after the root moves.
8. Subdomain `guide` → the user guide, once Claude has published it as a paged site. Claude will put the value in this
   file when it exists; create the subdomain then, or now and set the website later.

## What you never need to do again

Apart from the yearly RENEW, releases: `pnpm release` writes a new feed update; the names follow it. Rollback: an older reference written as the
newest update. The only reasons to touch a name again are a lost feed key (`SWARMTYP_FEED_KEY` in `.env.local`,
never committed) or a decision to point a subdomain elsewhere.

## If something goes wrong

- MetaMask shows a different recipient contract: cancel, tell Claude.
- A transaction fails or the UI errors after confirming: nothing was charged beyond gas; wait a minute, reload, look
  at the name's current records before retrying so nothing is set twice.
- The site shows "not found" for a name right after setting it: the gateway caches for five minutes; Freedom does not.
