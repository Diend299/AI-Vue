import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../views/Home.vue') },
    { path: '/login', name: 'login', component: () => import('../views/Login.vue') },
    { path: '/register', name: 'register', component: () => import('../views/Register.vue') },
    {
      path: '/studio',
      name: 'studio',
      component: () => import('../views/Studio/index.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/community',
      name: 'community',
      component: () => import('../views/Community/index.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/rag',
      name: 'rag',
      component: () => import('../views/RagChat.vue'),
      meta: { requiresAuth: true }
    },
    { path: '/dashboard', redirect: '/studio' }
  ]
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if ((to.name === 'login' || to.name === 'register') && auth.isLoggedIn) {
    return { path: '/studio' }
  }
  return true
})

export default router
