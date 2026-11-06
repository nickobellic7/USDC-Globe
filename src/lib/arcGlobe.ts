import { arcTestnet } from 'viem/chains'
import type { Address } from 'viem'

const raw = import.meta.env.VITE_ARC_GLOBE_ADDRESS as string | undefined

export const ARC_GLOBE_ADDRESS = raw as Address | undefined
export const ARC_GLOBE_CHAIN_ID = arcTestnet.id

const pinComponents = [
  { name: 'user', type: 'address' },
  { name: 'latDeci', type: 'int16' },
  { name: 'lonDeci', type: 'int16' },
  { name: 'updatedAt', type: 'uint64' },
  { name: 'city', type: 'string' },
] as const

export const ARC_GLOBE_ABI = [
  {
    type: 'function',
    name: 'setPin',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'latDeci', type: 'int16' },
      { name: 'lonDeci', type: 'int16' },
      { name: 'city', type: 'string' },
    ],
    outputs: [],
  },
  { type: 'function', name: 'removePin', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    type: 'function',
    name: 'totalPins',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getPins',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [{ name: 'page', type: 'tuple[]', components: pinComponents }],
  },
  {
    type: 'event',
    name: 'PinSet',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'latDeci', type: 'int16', indexed: false },
      { name: 'lonDeci', type: 'int16', indexed: false },
      { name: 'city', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PinRemoved',
    inputs: [{ name: 'user', type: 'address', indexed: true }],
  },
] as const

export interface GlobePin {
  user: Address
  lat: number
  lon: number
  city: string
  updatedAt: number
  /** Raw USDC balance (ERC-20 view), or undefined while loading. */
  usdc?: bigint
}
