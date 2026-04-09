<template>
  <div class="task-history">
    <div v-if="!displayTasks.length" class="empty">暂无任务，提交后将在此展示。</div>
    
    <div v-else class="history-grid">
      <article 
        v-for="(row, index) in displayTasks" 
        :key="taskRowKey(row, index)" 
        class="history-card"
      >
        <div class="thumb-wrap">
          <el-image
            v-if="getImageUrl(row.resultUrl)"
            class="thumb"
            :src="getImageUrl(row.resultUrl)"
            fit="cover"
            :preview-src-list="[getImageUrl(row.resultUrl)]"
            preview-teleported
          />
          <div v-else class="thumb-placeholder">
            <span>{{ statusLabel(row.status) }}</span>
          </div>
        </div>
        <div class="card-body">
          <div class="card-head">
            <span class="serial">创作 #{{ index + 1 }}</span>
            <time
              class="when"
              :title="absoluteTimeTitle(row)"
            >{{ relativeTimeLabel(row) }}</time>
          </div>
          <p class="prompt-line" :title="String(row.prompt ?? '')">{{ row.prompt || '（无提示词）' }}</p>
          <div class="card-foot">
            <el-tag size="small" :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
            <el-button
              v-if="getImageUrl(row.resultUrl)"
              link
              type="primary"
              @click="openImage(row.resultUrl)"
            >
              新窗口打开
            </el-button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskListItem } from '@/api/aigc'
import { resolveMediaUrl } from '@/utils/mediaUrl'
import { formatAbsoluteTime, formatRelativeTime } from '@/utils/formatTime'
import { getTaskSubmittedAt, getTaskTimeMs, sortTasksNewestFirst } from '@/utils/taskList'

const props = defineProps<{
  tasks: TaskListItem[]
  nowTick?: number
}>()

const emit = defineEmits<{
  openImage: [url: string]
}>()

// 排序后的任务列表（使用计算属性确保响应式更新）
const displayTasks = computed(() => {
  // 使用 nowTick 触发重新计算
  void props.nowTick
  return sortTasksNewestFirst(props.tasks)
})

// 状态标签
function statusLabel(status: string | undefined): string {
  const s = (status || '').toUpperCase()
  if (s === 'PENDING') return '排队中'
  if (s === 'PROCESSING') return '生成中'
  if (s === 'DONE') return '已完成'
  if (s === 'ERROR') return '失败'
  return status || '未知'
}

// 状态标签类型
function statusTagType(status: string | undefined): 'success' | 'warning' | 'info' | 'danger' {
  const s = (status || '').toUpperCase()
  if (s === 'DONE') return 'success'
  if (s === 'ERROR') return 'danger'
  if (s === 'PROCESSING') return 'warning'
  return 'info'
}

// 相对时间
function relativeTimeLabel(row: TaskListItem): string {
  void props.nowTick
  const t = getTaskSubmittedAt(row)
  return formatRelativeTime(t)
}

// 绝对时间标题
function absoluteTimeTitle(row: TaskListItem): string {
  const t = getTaskSubmittedAt(row)
  const abs = formatAbsoluteTime(t)
  return abs ? `提交时间：${abs}` : '提交时间未知'
}

// 任务行键值
function taskRowKey(row: TaskListItem, index: number): string {
  const id = row.taskId
  if (typeof id === 'string' && id) {
    return id
  }
  return `row-${index}-${getTaskTimeMs(row)}`
}

// 获取图片URL
function getImageUrl(url: string | undefined): string {
  return resolveMediaUrl(url) || ''
}

// 打开图片
function openImage(url: string | undefined) {
  const fullUrl = resolveMediaUrl(url)
  if (fullUrl) {
    emit('openImage', fullUrl)
  }
}
</script>

<style scoped>
.task-history {
  width: 100%;
}

.empty {
  padding: 24px;
  text-align: center;
  color: rgba(238, 243, 255, 0.5);
  font-size: 14px;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.history-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
}

.thumb-wrap {
  flex-shrink: 0;
  width: 96px;
  height: 96px;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.35);
}

.thumb {
  width: 96px;
  height: 96px;
}

.thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: rgba(238, 243, 255, 0.55);
  text-align: center;
  padding: 4px;
}

.card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.serial {
  font-size: 13px;
  font-weight: 600;
  color: #c8d7ff;
}

.when {
  flex-shrink: 0;
  font-size: 12px;
  color: rgba(238, 243, 255, 0.55);
}

.prompt-line {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(238, 243, 255, 0.85);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
}
</style>