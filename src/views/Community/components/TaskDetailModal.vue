<template>
  <el-dialog
    v-model="visible"
    :title="null"
    width="900"
    class="task-detail-modal"
    :close-on-click-modal="true"
    :destroy-on-close="true"
    @close="handleClose"
  >
    <div v-if="loading" class="loading-wrapper">
      <el-skeleton :rows="10" animated />
    </div>

    <div v-else-if="taskDetail" class="detail-content">
      <!-- 左侧：高清大图 -->
      <div class="image-section">
        <el-image
          :src="resolveMediaUrl(taskDetail.resultUrl || '')"
          fit="contain"
          :preview-src-list="[resolveMediaUrl(taskDetail.resultUrl || '')]"
          class="detail-image"
        >
          <template #placeholder>
            <div class="image-placeholder">
              <el-icon :size="48"><Picture /></el-icon>
            </div>
          </template>
          <template #error>
            <div class="image-error">
              <el-icon :size="48"><Picture /></el-icon>
              <span>图片加载失败</span>
            </div>
          </template>
        </el-image>
      </div>

      <!-- 右侧：元数据信息 -->
      <div class="meta-section">
        <div class="meta-header">
          <div class="author-info">
            <el-avatar :size="40" class="author-avatar">
              {{ taskDetail.username ? taskDetail.username.charAt(0).toUpperCase() : '?' }}
            </el-avatar>
            <div class="author-meta">
              <div class="author-name">{{ taskDetail.username || '匿名用户' }}</div>
              <div class="create-time">{{ formatTime(taskDetail.createTime) }}</div>
            </div>
          </div>
        </div>

        <el-divider />

        <!-- 提示词 -->
        <div class="meta-item prompt-section">
          <div class="meta-label">
            <el-icon><Document /></el-icon>
            <span>提示词 Prompt</span>
          </div>
          <div class="prompt-content">{{ taskDetail.prompt || '无' }}</div>
          <el-button
            v-if="taskDetail.prompt"
            type="primary"
            link
            :icon="CopyDocument"
            @click="copyText(taskDetail.prompt, '提示词')"
            class="copy-btn"
          >
            复制
          </el-button>
        </div>

        <!-- 模型类型 -->
        <div class="meta-item">
          <div class="meta-label">
            <el-icon><Cpu /></el-icon>
            <span>模型类型</span>
          </div>
          <div class="meta-value">
            <el-tag :type="taskDetail.modelType === 'FLUX' ? 'success' : 'primary'" effect="light">
              {{ taskDetail.modelType || 'SDXL' }}
            </el-tag>
          </div>
        </div>

        <!-- LoRA 信息 -->
        <div v-if="loraList.length > 0" class="meta-item lora-section">
          <div class="meta-label">
            <el-icon><Collection /></el-icon>
            <span>LoRA 模型 ({{ loraList.length }})</span>
          </div>
          <div class="lora-list">
            <div v-for="(lora, index) in loraList" :key="index" class="lora-item">
              <el-tag type="warning" effect="light" class="lora-name">{{ lora.name }}</el-tag>
              <div class="lora-strength">
                <el-slider v-model="lora.strength" :min="0" :max="1" :step="0.05" disabled class="strength-slider" />
                <span class="strength-value">{{ lora.strength.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- LLM 增强 -->
        <div class="meta-item">
          <div class="meta-label">
            <el-icon><MagicStick /></el-icon>
            <span>LLM 增强</span>
          </div>
          <div class="meta-value">
            <el-tag :type="taskDetail.isUseLLM ? 'success' : 'info'" effect="light">
              {{ taskDetail.isUseLLM ? '已开启' : '未开启' }}
            </el-tag>
          </div>
        </div>

        <!-- 参考图 -->
        <div v-if="taskDetail.referenceImageUrl" class="meta-item">
          <div class="meta-label">
            <el-icon><Picture /></el-icon>
            <span>参考图</span>
          </div>
          <div class="meta-value">
            <el-tag type="info" effect="light">已上传</el-tag>
          </div>
        </div>

        <el-divider />

        <!-- 操作按钮区 -->
        <div class="action-area">
          <!-- 所有用户都可以复制任务参数（参考图不会被复制） -->
          <el-button
            type="primary"
            size="large"
            :icon="CopyDocument"
            class="copy-task-btn"
            @click="copyTaskToStudio"
          >
            {{ isInStudio ? '再次创作' : '复制任务参数' }}
          </el-button>

          <el-button
            type="default"
            size="large"
            @click="handleClose"
          >
            关闭
          </el-button>
        </div>
      </div>
    </div>

    <div v-else class="error-wrapper">
      <el-empty description="加载任务详情失败" />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Picture,
  Document,
  Cpu,
  Collection,
  MagicStick,
  CopyDocument
} from '@element-plus/icons-vue'
import { resolveMediaUrl } from '@/utils/mediaUrl'
import { getTaskDetailApi, type TaskDetailData } from '@/api/community'
import type { ApiResult } from '@/api/aigc'

const props = defineProps<{
  modelValue: boolean
  taskId: string | null
}>()

interface FormFillPayload {
  prompt: string
  modelType: string
  isUseLLM: boolean
  loras: Array<{ id: string; name?: string; strength: number }>
}

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'fillForm': [payload: FormFillPayload]
}>()

const router = useRouter()

const loading = ref(false)
const taskDetail = ref<TaskDetailData | null>(null)

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 判断是否在当前Studio页面
const isInStudio = computed(() => {
  return router.currentRoute.value.path === '/studio'
})

// 处理LoRA数据，兼容多种后端格式
const loraList = computed(() => {
  if (!taskDetail.value) return []

  // 格式1：loraConfigs数组（后端实际返回的格式）
  if (taskDetail.value.loraConfigs && taskDetail.value.loraConfigs.length > 0) {
    return taskDetail.value.loraConfigs.map(config => ({
      id: String(config.id),
      name: config.name || config.fileName || String(config.id),
      strength: config.strength
    }))
  }

  // 格式2：loras数组
  if (taskDetail.value.loras && taskDetail.value.loras.length > 0) {
    return taskDetail.value.loras.map(lora => ({
      id: String(lora.id),
      name: lora.name || String(lora.id),
      strength: lora.strength
    }))
  }

  // 格式3：单个lora（老格式）
  if (taskDetail.value.loraModel) {
    return [{
      id: taskDetail.value.loraModel,
      name: taskDetail.value.loraModel.split('/').pop() || taskDetail.value.loraModel,
      strength: taskDetail.value.loraStrength || 0.75
    }]
  }

  return []
})

// 监听弹窗打开，加载任务详情
watch(() => props.modelValue, (newVal) => {
  if (newVal && props.taskId) {
    loadTaskDetail(props.taskId)
  }
})

watch(() => props.taskId, (newTaskId) => {
  if (newTaskId && visible.value) {
    loadTaskDetail(newTaskId)
  }
})

async function loadTaskDetail(taskId: string) {
  loading.value = true
  taskDetail.value = null
  try {
    const res: ApiResult<TaskDetailData> = await getTaskDetailApi(taskId)
    if (res.code === 200) {
      taskDetail.value = res.data
    } else {
      ElMessage.error(res.msg || '获取任务详情失败')
    }
  } catch (error) {
    console.error('[TaskDetailModal] 加载任务详情失败:', error)
    ElMessage.error('获取任务详情失败')
  } finally {
    loading.value = false
  }
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '-'
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success(`${label}已复制到剪贴板`)
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

// 一键复制到Studio（或在Studio页面直接回填）
function copyTaskToStudio() {
  if (!taskDetail.value) return

  const currentPath = router.currentRoute.value.path
  
  // 如果在Studio页面，直接发送回填事件，不跳转
  if (currentPath === '/studio') {
    emit('fillForm', {
      prompt: taskDetail.value.prompt || '',
      modelType: taskDetail.value.modelType || 'SDXL',
      isUseLLM: taskDetail.value.isUseLLM || false,
      loras: loraList.value.length > 0 ? loraList.value : []
    })
    visible.value = false
    ElMessage.success('任务参数已回填到表单')
    return
  }

  // 如果在其他页面，跳转到Studio
  const queryParams: Record<string, string> = {
    prompt: taskDetail.value.prompt || '',
    modelType: taskDetail.value.modelType || 'SDXL',
    isUseLLM: String(taskDetail.value.isUseLLM || false)
  }

  // 添加LoRA参数
  if (loraList.value.length > 0) {
    queryParams.loras = JSON.stringify(loraList.value.map(l => ({
      id: l.id,
      strength: l.strength
    })))
  }

  // 关闭弹窗
  visible.value = false

  // 跳转到Studio页面
  router.push({
    path: '/studio',
    query: queryParams
  })

  ElMessage.success('已跳转至创作工作台，任务参数已填充')
}

function handleClose() {
  visible.value = false
  taskDetail.value = null
}
</script>

<style scoped>
.task-detail-modal :deep(.el-dialog__header) {
  display: none;
}

.task-detail-modal :deep(.el-dialog__body) {
  padding: 0;
  background: #1a1c26;
}

.detail-content {
  display: flex;
  min-height: 500px;
  max-height: 80vh;
}

/* 左侧图片区域 */
.image-section {
  flex: 1;
  min-width: 400px;
  max-width: 600px;
  background: #0a0b10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.detail-image {
  max-width: 100%;
  max-height: 600px;
  border-radius: 8px;
}

.image-placeholder,
.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 400px;
  color: #5a5d6a;
  gap: 12px;
}

/* 右侧元数据区域 */
.meta-section {
  flex: 0 0 400px;
  padding: 24px;
  overflow-y: auto;
  color: #e2e4e9;
}

.meta-header {
  margin-bottom: 16px;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-avatar {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: #fff;
  font-weight: 600;
}

.author-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.author-name {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.create-time {
  font-size: 12px;
  color: #8f95a3;
}

.meta-item {
  margin-bottom: 20px;
}

.meta-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #8f95a3;
  margin-bottom: 8px;
}

.meta-label .el-icon {
  color: #4facfe;
}

.meta-value {
  padding-left: 24px;
}

.prompt-section {
  position: relative;
}

.prompt-content {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  color: #e2e4e9;
  max-height: 150px;
  overflow-y: auto;
  word-break: break-word;
}

.copy-btn {
  position: absolute;
  top: 0;
  right: 0;
  padding: 4px 8px;
}

/* LoRA 列表 */
.lora-section {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 12px;
}

.lora-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lora-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.lora-name {
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lora-strength {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.strength-slider {
  flex: 1;
  --el-slider-height: 4px;
  --el-slider-button-size: 12px;
}

.strength-slider :deep(.el-slider__button) {
  display: none;
}

.strength-value {
  min-width: 36px;
  text-align: center;
  font-size: 12px;
  color: #4facfe;
  background: rgba(79, 172, 254, 0.15);
  padding: 2px 8px;
  border-radius: 4px;
}

/* 操作区域 */
.action-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.copy-task-btn {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  border: none;
  font-weight: 600;
}

.copy-task-btn:hover {
  background: linear-gradient(135deg, #6a8aff 0%, #4facfe 100%);
}

.privacy-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  color: #8f95a3;
  font-size: 13px;
}

.privacy-hint .el-icon {
  color: #e6a23c;
}

/* 加载状态 */
.loading-wrapper {
  padding: 40px;
}

.error-wrapper {
  padding: 60px 40px;
}

/* 分割线样式 */
:deep(.el-divider) {
  border-color: rgba(255, 255, 255, 0.1);
  margin: 16px 0;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .detail-content {
    flex-direction: column;
  }

  .image-section {
    min-width: auto;
    max-width: none;
    max-height: 400px;
  }

  .detail-image {
    max-height: 350px;
  }

  .meta-section {
    flex: none;
    width: 100%;
  }
}
</style>
