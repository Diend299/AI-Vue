import request from '../utils/request'
import type { ApiResult } from './aigc.ts'

// 后端原始返回的数据结构
export interface BackendCommunityPost {
  taskId: string
  resultUrl: string | null
  prompt: string
  username: string
  totalLikes: number
  isLiked: boolean | null
  createTime: string
}

// 前端使用的接口
export interface CommunityPost {
  id: string
  imageUrl: string
  title: string
  authorName: string
  authorAvatar?: string
  totalLikes: number
  isLiked: boolean
  width: number
  height: number
  createTime: string
}

// 任务详情数据结构（后端返回的元数据）
export interface TaskDetailData {
  taskId: string
  userId: number
  username: string
  prompt: string
  modelType: 'SDXL' | 'FLUX'
  loras?: Array<{
    id: string | number
    name: string
    strength: number
  }>
  loraConfigs?: Array<{
    id: string | number
    name: string
    strength: number
    fileName?: string
  }>
  loraModel?: string
  loraStrength?: number
  isUseLLM: boolean
  referenceImageUrl?: string
  resultUrl?: string
  status: string
  createTime: string
}

export interface CommunityListParams {
  page: number
  pageSize: number
}

export function getCommunityListApi(params: CommunityListParams): Promise<ApiResult<{ records: BackendCommunityPost[], total: number }>> {
  return request({
    url: '/community/list',
    method: 'get',
    params
  })
}

export function likePostApi(taskId: string) {
  return request<ApiResult<void>>({
    url: '/community/like',
    method: 'post',
    data: { taskId }
  }).then((res) => res as unknown as ApiResult<void>)
}

/**
 * 获取任务详情（元数据）
 * @param taskId 任务ID
 */
export function getTaskDetailApi(taskId: string): Promise<ApiResult<TaskDetailData>> {
  return request<ApiResult<TaskDetailData>>({
    url: `/task/detail/${taskId}`,
    method: 'get'
  }).then((res) => res as unknown as ApiResult<TaskDetailData>)
}
