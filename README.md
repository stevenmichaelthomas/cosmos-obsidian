# Cosmos

Turn your Obsidian vault into a solar system. Only the mathematical shadow of your writing leaves your machine.

## How it works

Every file in your vault is run through a one-way cryptographic transform on your device. The structure of your writing — its length, density, and form — determines what kind of body it becomes: a gas giant, a planet, a moon, an asteroid, or a comet. The transform then produces orbital parameters — size, mass, eccentricity, color, inclination — that govern how that body moves through space. These numbers are sent to Cosmos. The text that produced them is not.

Dense essays become gas giants. Short notes become asteroids and comets. The shape of your writing practice, rendered in orbital mechanics — without exposing a single word.

## What leaves your machine

| Sent | Not sent |
|------|----------|
| Orbital radius | Your words |
| Eccentricity | File names |
| Body size & mass | Vault structure |
| Color index | Any identifying data |

## Why it can't be reversed

The transform uses a per-system secret that only exists on your device. Without this key, the orbital parameters are cryptographically opaque — there is no path from the orbit back to the sentence. The same guarantee that protects passwords protects your writing.

## Installation

### Via BRAT (recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) in Obsidian
2. Open BRAT settings → "Add Beta Plugin"
3. Enter this repo URL
4. Enable "Cosmos" in Settings → Community Plugins

### Manual

Copy `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/stevenmichaelthomas/cosmos-obsidian/releases) into your vault at `.obsidian/plugins/cosmos-obsidian/`.

## Configuration

Open Settings → Cosmos:

- **System name** — your solar system's name (locked after first sync)
- **Star name** — group entries under a named star (blank = auto: Sol 1, Sol 2, ...)
- **Sync folder** — limit sync to a specific folder (blank = entire vault)

## Usage

- **Sync:** Command palette → "Cosmos: Sync vault to Cosmos" or the orbit icon in the ribbon
- **Delete:** Command palette → "Cosmos: Delete system from Cosmos" (requires the original vault that created the system)

Each sync reads your vault, computes orbital parameters locally, and uploads only the metadata for new entries. Your system name is locked to a slug after the first sync — renaming won't create duplicates.

Only the vault that created a system can delete it. Ownership is verified cryptographically via a per-vault secret.

## Explore the galaxy

[cosmos-app-three.vercel.app](https://cosmos-app-three.vercel.app)

A science-based art project.
