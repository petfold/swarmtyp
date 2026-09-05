# Pointing swarmtyp.gwei at the editor (D-25)

Step 1, test first: on https://gwei.domains open swarmtyp.gwei, create the subdomain `app` (owner-only, free apart from gas),
then on app.swarmtyp.gwei choose "Set Website" and paste the release feed manifest:

    bzz://b656fac57eb02756af40279cf70275969c9f9219818af7cceee34101f169a100

Then tell Claude; it checks https://app.swarmtyp.gwei.domains/ (12 MB load, worker, fonts through the gateway) and bzz://app.swarmtyp.gwei/ in Freedom.

Step 2, once that works: set the same value as the website of the root name swarmtyp.gwei.

Optional now or later, also free apart from gas:
- subdomain `demo` → the S11 sample site's manifest: bzz://fff4e38ecaeb5253c1c7eae0e24daf655cc9ae995df806e507af0094de072910
- subdomain `guide` → to be created once the user guide is published as a paged site.
