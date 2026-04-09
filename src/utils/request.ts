import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { ElMessage } from 'element-plus'

const service = axios.create({
  baseURL: '/api', // 对应 vite proxy 配置
  timeout: 10000
})

// 请求拦截
service.interceptors.request.use(config => {
  const authStore = useAuthStore()
  if (authStore.token) {
    config.headers['Authorization'] = `Bearer ${authStore.token}`
  }
  return config
})

// 响应拦截
service.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response?.status === 401) {
      ElMessage.error('登录失效，请重新登录')
      // 处理退出逻辑
    }
    return Promise.reject(error)
  }
)

export default service