export function newFoldId(): string {
  return `fold-${crypto.randomUUID()}`
}

export function newFaceId(): string {
  return `face-${crypto.randomUUID()}`
}
