# Arc USDC Globe

An interactive 3D globe of Arc wallets that chose to share a coarse location. Each pin is sized by the wallet's live USDC balance, and anyone can add or remove their own pin from a connected wallet.

Built with [Arc Studio](https://studio.arc.io)

Live app: https://nikobel7-app-c6c09b51-9e80-46a6-9dc1-ef0373ffc992.static.hf.space

## Features

- Drag, scroll, or use arrow keys to turn the globe; pause the rotation or jump to your own pin.
- Pin size reflects USDC held, with the pinned wallets' share of USDC supply on Arc Testnet.
- Search and sort the list of pinned wallets, and copy a link that opens straight to a pin.

## Tech stack

- React, Vite, TypeScript, Tailwind CSS
- wagmi, viem, ConnectKit
- d3-geo and topojson for the globe projection
- Solidity registry contract on Arc Testnet (Foundry)

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://getfoundry.sh).

```bash
bun install
bun run dev
```

Checks and contract build:

```bash
bun run check
bun run contracts:build
```

### Environment variables

- `VITE_ARC_GLOBE_ADDRESS`: address of the deployed globe registry contract on Arc Testnet.

## Privacy

Pins are optional and public. Locations are rounded to a whole degree (about 110 km), and locations are self-reported, not verified.
