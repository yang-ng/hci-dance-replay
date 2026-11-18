function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('dance-replay-local', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('practice')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

async function readRecord(key) {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('practice').objectStore('practice').get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

async function writeRecord(method, key, value) {
  const db = await openDatabase()
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('practice', 'readwrite')
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error)
      transaction.objectStore('practice')[method](value, key)
    })
  } finally {
    db.close()
  }
}

function workspaceKey(accountId) {
  return accountId ? `workspace:${accountId}` : 'workspace'
}

export function loadPractice(accountId) {
  return readRecord(workspaceKey(accountId))
}

export function savePractice(practice, accountId) {
  return writeRecord('put', workspaceKey(accountId), practice)
}

export function validUsername(username) {
  return /^[a-z0-9_.-]{3,32}$/i.test(username) && username.toLowerCase() !== 'demo'
}

async function passwordHash(password, salt, iterations) {
  const input = new TextEncoder().encode(password)
  const key = await crypto.subtle.importKey('raw', input, 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256)
  return new Uint8Array(hash)
}

export async function createLocalAccount(username, password) {
  if (!validUsername(username) || password.length < 8 || password.length > 128) throw new Error('Invalid account details')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iterations = 600_000
  const hash = await passwordHash(password, salt, iterations)
  const profile = { id: crypto.randomUUID(), username }
  try {
    await writeRecord('add', `account:${username.toLowerCase()}`, { profile, salt, iterations, hash })
    return profile
  } catch (error) {
    if (error?.name === 'ConstraintError') return null
    throw error
  }
}

export async function authenticateLocalAccount(username, password) {
  if (!validUsername(username) || !password || password.length > 128) return null
  const record = await readRecord(`account:${username.toLowerCase()}`)
  if (!record) return null
  const candidate = await passwordHash(password, record.salt, record.iterations)
  let difference = 0
  for (let i = 0; i < candidate.length; i++) difference |= candidate[i] ^ record.hash[i]
  return difference === 0 ? record.profile : null
}
