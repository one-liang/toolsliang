<script setup lang="ts">
import { Scale } from '@lucide/vue'
import {
  licenceName,
  openSourceComponents,
  openSourceLicenceCopy,
} from '@/features/shell/open-source-licences'
import { copy, getTool, isSupportedLocale } from '@/features/tools/catalog'

definePageMeta({
  layout: 'app-shell',
  validate: route => isSupportedLocale(String(route.params.locale)),
})

const { locale, withLocale } = useAppLocale()
const text = computed(() => openSourceLicenceCopy(locale.value))
const components = computed(() => openSourceComponents.map(component => ({
  ...component,
  licenceName: licenceName(component.licence),
  tools: component.tools
    .map(slug => getTool(slug))
    .filter(tool => tool !== undefined)
    .map(tool => ({ slug: tool.slug, name: copy(tool.name, locale.value) })),
})))

// A credits page answers no search, so it carries no canonical or hreflang of its own.
useHead(() => ({ title: text.value.title }))
useSeoMeta({ robots: 'noindex, follow' })
</script>

<template>
  <main id="main-content" class="workspace-page licences-page" tabindex="-1">
    <header class="tool-heading tool-heading--with-icon">
      <span class="tool-heading__icon"><Scale :size="26" aria-hidden="true" /></span>
      <div>
        <h1>{{ text.title }}</h1>
        <p>{{ text.intro }}</p>
      </div>
    </header>

    <section
      v-for="component in components"
      :id="component.id"
      :key="component.id"
      class="tool-contract licences-page__component"
      :aria-labelledby="`licence-${component.id}`"
    >
      <h2 :id="`licence-${component.id}`">{{ component.name }}</h2>
      <p>{{ component.role[locale] }}</p>
      <dl>
        <div>
          <dt>{{ text.usedBy }}</dt>
          <dd class="licences-page__tools">
            <NuxtLink v-for="tool in component.tools" :key="tool.slug" :to="withLocale(`/tools/${tool.slug}/`)">{{ tool.name }}</NuxtLink>
          </dd>
        </div>
        <div>
          <dt>{{ text.version }}</dt>
          <dd>{{ component.version }}</dd>
        </div>
        <div>
          <dt>{{ text.licence }}</dt>
          <dd>
            <a :href="component.licenceUrl" target="_blank" rel="noopener noreferrer">{{ component.licenceName }}</a>
            <span v-if="component.notice" class="licences-page__notice">{{ component.notice }}</span>
          </dd>
        </div>
        <div>
          <dt>{{ text.project }}</dt>
          <dd><a :href="component.projectUrl" target="_blank" rel="noopener noreferrer">{{ component.projectUrl.replace('https://', '') }}</a></dd>
        </div>
      </dl>
    </section>
  </main>
</template>
