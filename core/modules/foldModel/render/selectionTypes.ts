export type SelState =
  | { type: 'photo'; id: string }
  | { type: 'face';  id: string }
  | null
