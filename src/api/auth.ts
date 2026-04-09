import request from '../utils/request'
import type { ApiResult } from './aigc'

export interface LoginPayload {
  username: string
  password: string
}

/** 登录接口 data：后端若字段不同，在此对齐即可 */
export interface LoginData {
  token?: string
  userId?: number
  id?: number
}

export function loginApi(data: LoginPayload) {
  return request<ApiResult<LoginData>>({
    url: '/gateway/login',
    method: 'post',
    data
  }).then((res) => res as unknown as ApiResult<LoginData>)
}
