<template>
  <div 
    ref="gridRef"
    class="masonry-grid" 
    v-loading="loading" 
    element-loading-text="加载社区美图中..."
    element-loading-background="rgba(10, 11, 16, 0.8)"
  >
    <PostCard 
      v-for="post in posts" 
      :key="post.id" 
      :post="post"
      @load="resizeAllGridItems"
      @like="handleLike"
      @click="handleClick"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { CommunityPost } from '@/api/community'
import PostCard from './PostCard.vue'

const props = defineProps({
  posts: {
    type: Array as () => CommunityPost[],
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['like', 'click'])

const gridRef = ref<HTMLElement | null>(null)

// 瀑布流布局逻辑
const resizeGridItem = (item: HTMLElement) => {
  const grid = gridRef.value
  if (!grid) return
  const rowHeight = parseInt(window.getComputedStyle(grid).getPropertyValue('grid-auto-rows')) || 10
  const rowGap = parseInt(window.getComputedStyle(grid).getPropertyValue('grid-row-gap')) || 20
  const content = item.querySelector('.post-content') as HTMLElement
  if (!content) return
  const rowSpan = Math.ceil((content.getBoundingClientRect().height + rowGap) / (rowHeight + rowGap))
  item.style.gridRowEnd = `span ${rowSpan}`
}

const resizeAllGridItems = () => {
  const allItems = document.getElementsByClassName('post-card')
  for (let x = 0; x < allItems.length; x++) {
    resizeGridItem(allItems[x] as HTMLElement)
  }
}

// 转发点赞事件
const handleLike = (post: CommunityPost) => {
  emit('like', post)
}

// 转发点击事件
const handleClick = (post: CommunityPost) => {
  emit('click', post)
}

// 监听窗口变化
onMounted(() => {
  window.addEventListener('resize', resizeAllGridItems)
  resizeAllGridItems()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeAllGridItems)
})
</script>

<style scoped>
.masonry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  grid-auto-rows: 10px;
  grid-gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  padding-bottom: 20px;
}
</style>