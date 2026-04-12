# Cosmos — Obsidian Plugin

Turn your vault into a solar system. Only the mathematical shadow of your writing leaves your machine.

## How it works

Every file in your vault is run through a one-way cryptographic transform (keyed SHA-256) on your device. The output is a set of orbital parameters — size, mass, eccentricity, color, inclination — that determine how a body moves through space. These numbers are sent to Cosmos. The text that produced them is not.

Dense essays become gas giants. Short notes become asteroids and comets. The shape of your writing practice, rendered in orbital mechanics.

## What leaves your machine

| Sent | Not sent |
|------|----------|
| Orbital radius | Your words |
| Eccentricity | File names |
| Body size & mass | Vault structure |
| Color index | Any identifying data |

## Why it can't be reversed

The transform uses a per-system secret generated on your device. Without this key, the orbital parameters are cryptographically opaque — there is no path from the orbit back to the sentence.

## Installation (BRAT)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) in Obsidian
2. Open BRAT settings → "Add Beta Plugin"
3. Enter this repo URL
4. Enable "Cosmos" in Settings → Community Plugins

## Configuration

Open Settings → Cosmos:

- **System name** — your solar system's name in Cosmos
- **Star name** — group entries under a named star (default: "default")
- **Sync folder** — limit sync to a specific folder (blank = entire vault)
- **Supabase URL** — your Cosmos backend URL
- **Supabase anon key** — your Cosmos public key

## Usage

- Command palette: "Cosmos: Sync vault to Cosmos"
- Ribbon icon: planet icon in the left sidebar

Each sync reads your vault, computes orbital parameters locally, and uploads only the metadata for new entries.

## A science-based art project

Learn more at [cosmos-app-three.vercel.app](https://cosmos-app-three.vercel.app)
