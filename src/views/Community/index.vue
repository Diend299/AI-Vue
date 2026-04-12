<template>
  <div class="community-container">
    <header class="community-header">
      <h1>社区广场</h1>
      <p>发现 AI 创作之美</p>

      <!-- 👉 跳转工作台按钮 -->
      <el-button 
        type="primary" 
        class="go-studio-btn"
        @click="goToStudio"
      >
        前往创作工作台
      </el-button>
    </header>

    <el-scrollbar 
      height="calc(100vh - 160px)" 
      native
      @scroll="handleScroll"
      class="community-scrollbar"
    >
      <WaterfallGrid 
        :posts="posts" 
        :loading="loading"
        @like="handleLike"
        @click="handlePostClick"
      />
    </el-scrollbar>

    <div v-if="finished && posts.length > 0" class="no-more">—— 已经到底啦 ——</div>

    <!-- 任务详情弹窗 -->
    <TaskDetailModal
      v-model="detailModalVisible"
      :task-id="selectedTaskId"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { getCommunityListApi, likePostApi, type CommunityPost, type BackendCommunityPost } from '@/api/community'
import { type ApiResult } from '@/api/aigc'
import WaterfallGrid from './components/WaterfallGrid.vue'
import TaskDetailModal from './components/TaskDetailModal.vue'

// 路由实例
const router = useRouter()

// 状态管理
const posts = ref<CommunityPost[]>([])
const loading = ref(false)      // 加载中锁：防止重复请求
const finished = ref(false)     // 全部加载完标志
const page = ref(1)
const infiniteScrollDistance = 200
const loadedIds = ref<Set<string | number>>(new Set()) // 已加载ID集合，用于去重

// 详情弹窗状态
const detailModalVisible = ref(false)
const selectedTaskId = ref<string | null>(null)

// 👉 跳转到创作工作台
const goToStudio = () => {
  router.push({ path: '/studio' })
}

// 👉 点击帖子打开详情弹窗
const handlePostClick = (post: CommunityPost) => {
  selectedTaskId.value = post.id
  detailModalVisible.value = true
}

// 滚动加载处理
const handleScroll = ({ scrollTop }: { scrollTop: number; scrollLeft: number }) => {
  const scrollbar = document.querySelector('.community-scrollbar .el-scrollbar__wrap') as HTMLElement
  if (!scrollbar) return
  
  const { scrollHeight, clientHeight } = scrollbar
  const distanceToBottom = scrollHeight - scrollTop - clientHeight
  
  // 核心防护1：如果正在加载或者已经加载完了，直接拒绝请求
  if (distanceToBottom < infiniteScrollDistance && !loading.value && !finished.value) {
    loadData()
  }
}

// 加载数据
const loadData = async () => {
  // 核心防护1：如果正在加载或者已经加载完了，直接拒绝请求
  if (loading.value || finished.value) {
    console.log('[Community] 加载被拒绝:', { loading: loading.value, finished: finished.value })
    return
  }
  
  loading.value = true
  console.log('[Community] 开始加载第', page.value, '页数据')
  
  try {
    const res: ApiResult<{ records: BackendCommunityPost[], total: number }> = await getCommunityListApi({ page: page.value, pageSize: 20 })
    if (res.code === 200) {
      const records = res.data.records || []
      
      // 后端返回空数组，说明没有更多数据了
      if (records.length === 0) {
        finished.value = true
        console.log('[Community] 数据已全部加载完毕')
        return
      }
      
      const newList: CommunityPost[] = records.map((record: BackendCommunityPost) => ({
        id: record.taskId,
        imageUrl: record.resultUrl || '',
        title: record.prompt ? String(record.prompt).substring(0, 50) + '...' : '无标题',
        authorName: record.username,
        authorAvatar: undefined,
        totalLikes: record.totalLikes || 0,
        isLiked: record.isLiked || false,
        width: 512,
        height: 512,
        createTime: record.createTime
      }))

      // 去重处理：过滤掉已经加载过的数据（防止网络抖动导致的重复数据）
      const uniqueList = newList.filter(post => {
        if (loadedIds.value.has(post.id)) {
          console.log('[Community] 去重过滤:', post.id)
          return false
        }
        return true
      })
      
      // 将新数据的ID加入已加载集合
      uniqueList.forEach(post => {
        loadedIds.value.add(post.id)
      })
      
      // 只有有新数据时才添加到列表
      if (uniqueList.length > 0) {
        posts.value.push(...uniqueList)
        console.log('[Community] 成功加载', uniqueList.length, '条新数据')
      }

      // 判断是否全部加载完毕
      if (records.length < 20 || uniqueList.length === 0) {
        finished.value = true
        console.log('[Community] 数据已全部加载完毕')
      } else {
        page.value++
      }
      
      nextTick(() => {
        const event = new CustomEvent('resizeGrid')
        window.dispatchEvent(event)
      })
    }
  } catch (error) {
    console.error('[Community] 加载失败:', error)
    ElMessage.error('获取社区内容失败')
  } finally {
    loading.value = false
  }
}

// 点赞逻辑
const handleLike = async (post: CommunityPost) => {
  const originalLiked = post.isLiked
  const originalCount = post.totalLikes

  post.isLiked = !post.isLiked
  post.totalLikes += post.isLiked ? 1 : -1

  try {
    const res = await likePostApi(post.id)
    if (res.code !== 200) throw new Error()
  } catch (err) {
    post.isLiked = originalLiked
    post.totalLikes = originalCount
    ElMessage.error('操作失败，请重试')
  }
}

// 生命周期
onMounted(() => {
  loadData()
  window.addEventListener('resizeGrid', () => {
    const allItems = document.getElementsByClassName('post-card')
    for (let x = 0; x < allItems.length; x++) {
      resizeGridItem(allItems[x] as HTMLElement)
    }
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resizeGrid', () => {})
})

// 瀑布流布局辅助函数
const resizeGridItem = (item: HTMLElement) => {
  const grid = document.querySelector('.masonry-grid') as HTMLElement
  if (!grid) return
  const rowHeight = parseInt(window.getComputedStyle(grid).getPropertyValue('grid-auto-rows')) || 10
  const rowGap = parseInt(window.getComputedStyle(grid).getPropertyValue('grid-row-gap')) || 20
  const content = item.querySelector('.post-content') as HTMLElement
  if (!content) return
  const rowSpan = Math.ceil((content.getBoundingClientRect().height + rowGap) / (rowHeight + rowGap))
  item.style.gridRowEnd = `span ${rowSpan}`
}
</script>

<style scoped>
.community-container {
  min-height: 100vh;
  background: #0a0b10;
  padding: 40px 20px;
  color: #fff;
  display: flex;
  flex-direction: column;
}

.community-header {
  text-align: center;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.community-header h1 {
  font-size: 2.5rem;
  background: linear-gradient(45deg, #00f2fe, #4facfe);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 8px;
}

.community-header p {
  color: #8f95a3;
  font-size: 1.1rem;
  margin-bottom: 16px; /* 给按钮留出间距 */
}

/* 👉 跳转按钮样式（和整体风格统一） */
.go-studio-btn {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  border: none;
  color: #fff;
  font-weight: 600;
  padding: 10px 24px;
  border-radius: 10px;
  transition: all 0.3s ease;
}

.go-studio-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(79, 172, 255, 0.4);
}

.community-scrollbar {
  flex-grow: 1;
}

.no-more {
  text-align: center;
  padding: 20px;
  color: #8f95a3;
  flex-shrink: 0;
}

/* 适配移动端 */
@media (max-width: 600px) {
  .masonry-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    grid-gap: 12px;
  }
}
</style>
