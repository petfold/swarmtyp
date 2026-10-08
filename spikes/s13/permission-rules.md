# Rules that let Claude fund Freedom's node from Swarm Desktop's wallet

Two allow rules, one per action. Each matches exactly one thing, so nothing else is unlocked:

1. Edit Swarm Desktop's config, to add Freedom's node to the withdrawal whitelist:

   ```
   Edit(~/.local/share/Swarm Desktop/config.yaml)
   ```

2. Withdraw exactly 0.45 xDAI from Swarm Desktop's node wallet to Freedom's node wallet `0xc555a6efc44fae25e5a5755301f957a7f82d5c16`:

   ```
   Bash(curl -s -X POST "http://127.0.0.1:1633/wallet/withdraw/nativetoken?amount=450000000000000000&address=0xc555a6efc44fae25e5a5755301f957a7f82d5c16")
   ```

## How to add them

Type `/permissions` in Claude Code, open the **Allow** tab, choose **Add a new rule**, paste rule 1, and save it to the local project settings (`.claude/settings.local.json`, which is not committed). Do the same for rule 2.

Or put both in `.claude/settings.local.json` yourself:

```json
{
  "permissions": {
    "allow": [
      "Edit(~/.local/share/Swarm Desktop/config.yaml)",
      "Bash(curl -s -X POST \"http://127.0.0.1:1633/wallet/withdraw/nativetoken?amount=450000000000000000&address=0xc555a6efc44fae25e5a5755301f957a7f82d5c16\")"
    ]
  }
}
```

## Then

1. Claude adds the address under `withdrawal-addresses-whitelist` in the config.
2. You quit Swarm Desktop and start it again. Bee reads the whitelist only when it starts, and restarting your desktop app is better done by you.
3. Claude runs the withdrawal. Freedom sees the xDAI within seconds and buys the storage by itself.

Remove the two rules afterwards.
