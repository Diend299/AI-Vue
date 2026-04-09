import request from '../utils/request'

export interface ApiResult<T> {
  code: number
  msg: string
  data: T
}

export interface RegisterPayload {
  username: string
  password: string
  email: string
  age: number
}

export interface TaskStatusData {
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'ERROR'
  progress?: number
  resultUrl?: string
  errorMsg?: string
}

/** 任务列表项：兼容驼峰 / 下划线及多种时间字段名 */
export interface TaskListItem {
  taskId?: string
  prompt?: string
  status?: string
  progress?: number
  resultUrl?: string
  /** 提交/创建时间（ISO 或可被 Date 解析的字符串） */
  createdAt?: string
  createdTime?: string
  submitTime?: string
  createTime?: string
  created_at?: string
  [key: string]: unknown
}

/** LoRA模型信息 */
export interface LoRAModel {
  id: string
  name: string
  baseModel: string
  description?: string
  path?: string
}

/** 简化版LoRA选项（用于下拉框） */
export interface LoRAOption {
  id: string
  name: string
}

/** 模型类型 */
export type ModelType = 'LORA' | 'CHECKPOINT' | 'VAE'

/** 基础架构类型 */
export type BaseModelType = 'SDXL' | 'FLUX' | 'SD1.5' | 'PONY'

/** 模型信息 */
export interface ModelInfo {
  id: string
  name: string
  type: ModelType
  baseModel: BaseModelType
  description?: string
  path?: string
}

export function registerApi(payload: RegisterPayload) {
  return request<ApiResult<unknown>>({
    url: '/gateway/register',
    method: 'post',
    data: payload
  }).then((res) => res as unknown as ApiResult<unknown>)
}

export function submitTaskApi(formData: FormData) {
  return request<ApiResult<string>>({
    url: '/task/submit',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }).then((res) => res as unknown as ApiResult<string>)
}

export function getTaskStatusApi(taskId: string) {
  return request<ApiResult<TaskStatusData>>({
    url: `/task/status/${taskId}`,
    method: 'get'
  }).then((res) => res as unknown as ApiResult<TaskStatusData>)
}

export function getTaskListApi(userId: number) {
  return request<ApiResult<TaskListItem[]>>({
    url: '/task/list',
    method: 'get',
    params: { userId }
  }).then((res) => res as unknown as ApiResult<TaskListItem[]>)
}

/**
 * 获取LoRA模型列表
 * @param baseModel 可选，基础架构类型 SDXL/FLUX/SD1.5/PONY
 */
export function getLoRAModelsApi(baseModel?: BaseModelType) {
  return request<ApiResult<LoRAModel[]>>({
    url: '/models/lora',
    method: 'get',
    params: baseModel ? { baseModel } : undefined
  }).then((res) => res as unknown as ApiResult<LoRAModel[]>)
}

/**
 * 获取所有模型列表（可过滤）
 * @param type 可选，模型类型 LORA/CHECKPOINT/VAE
 * @param baseModel 可选，基础架构类型 SDXL/FLUX/SD1.5/PONY
 */
export function getModelsListApi(type?: ModelType, baseModel?: BaseModelType) {
  const params: Record<string, string> = {}
  if (type) params.type = type
  if (baseModel) params.baseModel = baseModel
  
  return request<ApiResult<ModelInfo[]>>({
    url: '/models/list',
    method: 'get',
    params: Object.keys(params).length > 0 ? params : undefined
  }).then((res) => res as unknown as ApiResult<ModelInfo[]>)
}

/**
 * 获取LoRA选项（简化版，适合前端下拉框）
 * @param baseModel 必填，基础架构类型 SDXL/FLUX/SD1.5/PONY
 */
export function getLoRAOptionsApi(baseModel: BaseModelType) {
  return request<ApiResult<LoRAOption[]>>({
    url: '/models/lora/options',
    method: 'get',
    params: { baseModel }
  }).then((res) => res as unknown as ApiResult<LoRAOption[]>)
}
