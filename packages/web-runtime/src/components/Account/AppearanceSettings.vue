<template>
  <oc-table-tr class="account-page-info-signature-color">
    <oc-table-td>{{ $gettext('Signature color') }}</oc-table-td>
    <oc-table-td>
      <span v-text="$gettext('Accent color of themes that support it. Empty: brand color.')" />
    </oc-table-td>
    <oc-table-td data-testid="signature-color">
      <oc-color-input
        :model-value="signatureColor || ''"
        :label="$gettext('Signature color')"
        @update:model-value="previewSignatureColor"
        @change="saveSignatureColor"
      />
    </oc-table-td>
  </oc-table-tr>
  <oc-table-tr v-if="canStoreBackground" class="account-page-info-background">
    <oc-table-td>{{ $gettext('Background') }}</oc-table-td>
    <oc-table-td>
      <span
        v-text="
          $gettext(
            'Background image of themes that support it. Stored hidden in your personal space.'
          )
        "
      />
    </oc-table-td>
    <oc-table-td data-testid="desktop-background">
      <oc-file-input
        :model-value="selectedBackgroundFiles"
        :label="$gettext('Background')"
        :file-types="desktopBackgroundFileTypes"
        :clear-button-enabled="false"
        :error-message="backgroundErrorMessage"
        preview-icon="image"
        @update:model-value="uploadBackground"
      />
      <oc-button
        v-if="backgroundImageUrl"
        class="mt-2"
        appearance="raw"
        no-hover
        data-testid="account-page-remove-background-btn"
        @click="removeBackground"
      >
        <span v-text="$gettext('Remove background')" />
      </oc-button>
    </oc-table-td>
  </oc-table-tr>
</template>

<script setup lang="ts">
import { computed, ref, unref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGettext } from 'vue3-gettext'
import { useMessages, useSpacesStore, useThemeStore } from '@opencloud-eu/web-pkg'
import {
  desktopBackgroundFileTypes,
  desktopBackgroundMaxBytes,
  useDesktopBackground
} from '../../composables/desktopBackground'

const { $gettext } = useGettext()
const { showMessage, showErrorMessage } = useMessages()
const themeStore = useThemeStore()
const spacesStore = useSpacesStore()
const { signatureColor, backgroundImageUrl } = storeToRefs(themeStore)
const { saveDesktopBackground, removeDesktopBackground } = useDesktopBackground()

const selectedBackgroundFiles = ref<FileList>()
const backgroundErrorMessage = ref('')

const canStoreBackground = computed(() => !!spacesStore.personalSpace)

// while the color dialog is open, only the look follows; the choice is stored on confirm
function previewSignatureColor(color: string) {
  document.documentElement.style.setProperty('--oc-signature', color || unref(signatureColor) || '')
}

function saveSignatureColor(color: string | null) {
  themeStore.setSignatureColor(color)
  showMessage({ title: $gettext('Preference saved.') })
}

async function uploadBackground(files: FileList) {
  const imageFile = files?.[0]
  backgroundErrorMessage.value = ''
  if (!imageFile) {
    return
  }
  if (!desktopBackgroundFileTypes.split(', ').includes(imageFile.type)) {
    backgroundErrorMessage.value = $gettext('Please choose a JPEG, PNG, WebP or AVIF image.')
    return
  }
  if (imageFile.size > desktopBackgroundMaxBytes) {
    backgroundErrorMessage.value = $gettext('The image is too large (10 MB at most).')
    return
  }
  try {
    await saveDesktopBackground(imageFile)
    selectedBackgroundFiles.value = files
    showMessage({ title: $gettext('Preference saved.') })
  } catch (e) {
    console.error(e)
    showErrorMessage({ title: $gettext('Unable to save preference…'), errors: [e] })
  }
}

async function removeBackground() {
  try {
    await removeDesktopBackground()
    selectedBackgroundFiles.value = undefined
    showMessage({ title: $gettext('Preference saved.') })
  } catch (e) {
    console.error(e)
    showErrorMessage({ title: $gettext('Unable to save preference…'), errors: [e] })
  }
}
</script>
