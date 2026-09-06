<script setup lang="ts">
import { HardDrive, LayoutList, X } from '@lucide/vue'
import {
  DialogClose, DialogContent, DialogDescription, DialogOverlay,
  DialogPortal, DialogRoot, DialogTitle, DialogTrigger,
} from 'reka-ui'
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { localAssetCopy } from '@/features/shell/local-assets/content'
import { copy, publishedToolCategories, toolsByCategory } from '@/features/tools/catalog'

const { locale, withLocale } = useAppLocale()
const { savedTools } = useSavedTools()
const route = useRoute()
const open = ref(false)

watch(() => route.fullPath, () => {
  open.value = false
})
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger class="mobile-nav__item mobile-nav__item--categories">
      <LayoutList :size="21" aria-hidden="true" />
      <span>{{ locale === 'en' ? 'Categories' : '分類' }}</span>
    </DialogTrigger>

    <DialogPortal>
      <DialogOverlay class="tool-drawer__overlay" />
      <DialogContent class="tool-drawer">
        <header class="tool-drawer__header">
          <DialogTitle class="tool-drawer__title">
            {{ locale === 'en' ? 'Tool categories' : '工具分類' }}
          </DialogTitle>
          <DialogClose as-child>
            <Button variant="ghost" size="icon" :aria-label="locale === 'en' ? 'Close categories' : '關閉分類導覽'">
              <X :size="20" aria-hidden="true" />
            </Button>
          </DialogClose>
        </header>
        <DialogDescription class="tool-drawer__description">
          {{ locale === 'en' ? 'Browse every published category and open a tool.' : '瀏覽所有已上線分類，直接開啟需要的工具。' }}
        </DialogDescription>

        <div class="tool-drawer__body">
          <section v-if="savedTools.length" class="drawer-saved">
            <h3 class="drawer-saved__title">{{ locale === 'en' ? 'Saved tools' : '常用工具' }}</h3>
            <NuxtLink
              v-for="tool in savedTools"
              :key="tool.slug"
              class="drawer-tool-link drawer-saved__link"
              :to="withLocale(`/tools/${tool.slug}/`)"
            >
              <ToolIcon :name="tool.icon" :size="19" />
              <span class="drawer-tool-link__name">{{ copy(tool.name, locale) }}</span>
            </NuxtLink>
          </section>

          <section v-for="category in publishedToolCategories" :key="category.id" class="drawer-category">
            <h3 class="drawer-category__title">{{ copy(category.name, locale) }}</h3>
            <p class="drawer-category__description">{{ copy(category.description, locale) }}</p>
            <NuxtLink
              v-for="tool in toolsByCategory(category.id)"
              :key="tool.slug"
              class="drawer-tool-link"
              :to="withLocale(`/tools/${tool.slug}/`)"
            >
              <ToolIcon :name="tool.icon" :size="19" />
              <span class="drawer-tool-link__name">{{ copy(tool.name, locale) }}</span>
              <ToolStatusBadge v-if="tool.status" :status="tool.status" :locale="locale" />
            </NuxtLink>
          </section>

          <NuxtLink class="drawer-storage-link" :to="withLocale('/storage/')">
            <HardDrive :size="19" aria-hidden="true" />
            <span class="drawer-storage-link__name">{{ localAssetCopy(locale).title }}</span>
          </NuxtLink>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
