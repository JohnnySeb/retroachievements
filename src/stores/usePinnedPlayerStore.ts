import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'ra:pinned-player'

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    // Navigation privee ou stockage bloque : le site fonctionne sans joueur epingle.
    return null
  }
}

export const usePinnedPlayerStore = defineStore('pinnedPlayer', () => {
  const username = ref<string | null>(readStored())

  function pin(name: string): void {
    const trimmed = name.trim()
    if (!trimmed) return
    username.value = trimmed
    try {
      localStorage.setItem(STORAGE_KEY, trimmed)
    } catch {
      // L'epinglage reste valable pour la session en cours.
    }
  }

  function unpin(): void {
    username.value = null
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Rien a nettoyer si le stockage est inaccessible.
    }
  }

  return { username, pin, unpin }
})
