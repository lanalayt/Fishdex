// Generate UUID without external dependency to avoid crypto issues on React Native
export function generateId(): string {
  const hex = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      id += '-';
    } else if (i === 14) {
      id += '4'; // version 4
    } else if (i === 19) {
      id += hex[(Math.random() * 4) | 8]; // variant bits
    } else {
      id += hex[(Math.random() * 16) | 0];
    }
  }
  return id;
}

export function now(): string {
  return new Date().toISOString();
}
