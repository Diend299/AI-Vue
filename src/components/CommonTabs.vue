<template>
  <el-tabs v-model="activeTab" @tab-change="handleTabChange">
    <el-tab-pane label="社区广场" name="community" />
    <el-tab-pane label="创作中心" name="studio" />
  </el-tabs>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeTab = ref('community')

// 接收外部默认值
const props = defineProps({
  defaultTab: {
    type: String,
    default: 'community'
  }
})

// 暴露事件
const emit = defineEmits(['tabChange'])

// 初始化tab
watch(() => props.defaultTab, (val) => {
  activeTab.value = val
}, { immediate: true })

// tab切换处理
const handleTabChange = (name: string) => {
  emit('tabChange', name)
  if (name === 'studio') {
    router.replace({ query: { tab: 'studio' } })
  } else {
    router.replace({ query: {} })
  }
}
</script>

<style scoped>
/* 复用原有Tab样式 */
:deep(.el-tabs__nav-wrap) {
  padding: 0 0 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 16px;
}

:deep(.el-tabs__item) {
  height: 48px !important;
  line-height: 48px !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  padding: 0 24px !important;
  margin-right: 8px !important;
  color: rgba(238, 243, 255, 0.6) !important;
  transition: all 0.3s ease !important;
  border-radius: 8px 8px 0 0 !important;
}

:deep(.el-tabs__item.is-active) {
  color: #6a8aff !important;
  background: rgba(106, 138, 255, 0.15) !important;
  text-shadow: 0 0 8px rgba(106, 138, 255, 0.4) !important;
}

:deep(.el-tabs__active-bar) {
  height: 3px !important;
  background: linear-gradient(90deg, #4facfe, #00f2fe) !important;
  border-radius: 2px !important;
  box-shadow: 0 0 8px rgba(79, 172, 254, 0.6) !important;
}

:deep(.el-tabs__item:hover:not(.is-active)) {
  color: rgba(238, 243, 255, 0.85) !important;
  background: rgba(255, 255, 255, 0.08) !important;
}

:deep(.el-tabs__nav-prev),
:deep(.el-tabs__nav-next) {
  display: none;
}
</style>