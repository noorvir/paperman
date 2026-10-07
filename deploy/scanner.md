# Scan to an SMB inbox

The optional scanner container exposes only the inbox. It uses SMB 2 or newer, requires the `scanner` account, and accepts only the configured printer address. Keep the printer and server addresses stable. The normal app does not require this container; API uploads and other inbox writers still work.

1. Create the inbox under the data directory, owned by the API/worker UID and GID.
2. Copy `smb.conf.example` to a deployment config outside the source checkout. Replace `PRINTER_IP` with the printer's LAN address.
3. Set `PAPERMAN_SCANNER_BIND` to the server's private LAN address and `PAPERMAN_SAMBA_CONFIG` to the config's absolute path. Set `PAPERMAN_UID` and `PAPERMAN_GID` to the data directory owner's IDs before building.
4. From the repository root, run `docker compose -f compose.yaml -f deploy/compose.scanner.yaml up --build -d scanner`.
5. Create the Samba password with `docker compose -f compose.yaml -f deploy/compose.scanner.yaml exec scanner smbpasswd -a scanner`. Store the password in your password manager and enter it in the printer destination. The `scanner_accounts` volume retains the account across restarts.
6. Configure the printer to write PDFs to `\\SERVER_LAN_IP\PaperMan Inbox`, with username `scanner`. Test destination access, then scan one batch. Check the dashboard and confirm the original scan and filed PDFs exist.

Keep an existing working printer shortcut until this route passes a real scan test. If folder authentication fails, compare the printer and server clocks. No Mac or workstation needs to stay on.

Do not publish SMB to the internet. Keep the scanner account volume with deployment backups, or reset the scanner password and update the printer during recovery. Document data remains in the normal data directory.
