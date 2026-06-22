// 혼동되는 i,l,o,1,0 등은 공개 id에서 제외
const ALPHABET = '0123456789abcdefghjkmnpqrstuvwxyz'

function randomFrom(set, len) {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let out = ''
  for (let i = 0; i < len; i++) out += set[bytes[i] % set.length]
  return out
}

export function shortId() { return randomFrom(ALPHABET, 6) }
export function secretToken() {
  const full = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return randomFrom(full, 32)
}
