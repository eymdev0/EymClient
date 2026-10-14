# EymClient 2.4.0

EymClient is a Windows Minecraft launcher built with Electron and Node.js. This repository contains application source code, not prebuilt installers.

## Features in this source snapshot

- Electron desktop launcher UI
- Microsoft/offline account flow
- Minecraft version and launch integration using `minecraft-launcher-core`
- Sponsor-server configuration with remote configuration and local fallback
- Modrinth project search/version selection and mod installation flow
- Fabric/optimization-related launcher features
- Electron updater configuration for `https://client.eymdev.com.tr/updates/`

## Requirements

- Windows 10/11 x64 recommended
- Node.js LTS and npm
- Internet connection for dependencies, authentication, Minecraft downloads, and Modrinth

## Run from source

```powershell
npm ci
npm start
```

## Build a Windows installer

```powershell
npm run build
```

The installer is generated under `dist/`. Do not commit `node_modules/` or generated `dist/` output to the source repository.

## Sponsor configuration

See [`SPONSOR-CONFIG.md`](SPONSOR-CONFIG.md) and `src/data/sponsors.json`. Never place private tokens or secrets in public sponsor configuration.

## Auto-updates

The build configuration points to `https://client.eymdev.com.tr/updates/`. Publishing updates requires uploading the actual electron-builder-generated installer, `.blockmap`, and `latest.yml`. Do not hand-edit or fabricate hashes in `latest.yml`.

## License and third-party software

A project-level open-source license has not been selected in this archive. Add a license only after confirming you have the rights to license the original code and assets. Dependencies and third-party assets retain their own licenses; review those before redistribution.

## Current scope

This is the source snapshot supplied for EymClient 2.4.0. Before public release, review assets and code for redistribution rights and ensure no private credentials or personal data are included.
