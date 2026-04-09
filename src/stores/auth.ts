import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const USER_ID_KEY = 'userId'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userId = ref(localStorage.getItem(USER_ID_KEY) || '')

  const isLoggedIn = computed(() => Boolean(userId.value.trim()))

  const userIdNumber = computed(() => {
    const n = Number(userId.value)
    return Number.isFinite(n) && n > 0 ? n : 0
  })

  function setSession(payload: { token: string; userId: string | number }) {
    token.value = payload.token
    userId.value = String(payload.userId)
    localStorage.setItem('token', token.value)
    localStorage.setItem(USER_ID_KEY, userId.value)
  }

  function logout() {
    token.value = ''
    userId.value = ''
    localStorage.removeItem('token')
    localStorage.removeItem(USER_ID_KEY)
  }

  return { token, userId, isLoggedIn, userIdNumber, setSession, logout }
})
