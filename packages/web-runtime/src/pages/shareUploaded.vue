<template>
  <div class="oc-link-resolve h-screen flex flex-col justify-center items-center p-4">
    <oc-card
      :title="headerTitle"
      body-class="text-center"
      header-class="text-center"
      class="w-auto md:w-lg rounded-lg"
    >
      <oc-spinner v-if="!errorMessage" :aria-hidden="true" />
      <p v-else data-testid="error-message" class="text-xl">{{ errorMessage }}</p>
    </oc-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, unref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import {
  createFileRouteOptions,
  createLocationSpaces,
  SHARE_UPLOADED_QUERY,
  useClientService,
  useRouter,
  useSpacesStore
} from '@opencloud-eu/web-pkg'
import { HttpError, Resource, SpaceResource } from '@opencloud-eu/web-client'

// Files shared to the installed web app land here (see `share_target` in
// manifest.json). This page only prepares the target folder and opens it, the
// files app then hands the parked files to the regular upload.
const UPLOAD_FOLDER = '/Uploaded'

const router = useRouter()
const { $gettext } = useGettext()
const clientService = useClientService()
const spacesStore = useSpacesStore()

const errorMessage = ref('')

function waitForSpaces(): Promise<void> {
  return new Promise((resolve) => {
    const stop = watch(
      () => spacesStore.spacesInitialized,
      (initialized) => {
        if (initialized) {
          stop?.()
          resolve()
        }
      },
      { immediate: true }
    )
  })
}

async function ensureUploadFolder(personalSpace: SpaceResource): Promise<Resource> {
  const { webdav } = clientService
  try {
    return await webdav.getFileInfo(personalSpace, { path: UPLOAD_FOLDER })
  } catch (e) {
    if (!(e instanceof HttpError) || e.statusCode !== 404) {
      throw e
    }
  }
  return webdav.createFolder(personalSpace, { path: UPLOAD_FOLDER })
}

async function openUploadFolder() {
  await waitForSpaces()
  const personalSpace = spacesStore.personalSpace
  if (!personalSpace) {
    throw new Error('personal space not found')
  }

  const uploadFolder = await ensureUploadFolder(personalSpace)
  const targetLocation = createLocationSpaces('files-spaces-generic')
  const { params, query } = createFileRouteOptions(personalSpace, {
    fileId: uploadFolder.fileId,
    path: UPLOAD_FOLDER
  })
  targetLocation.params = params
  targetLocation.query = { ...query, [SHARE_UPLOADED_QUERY]: '1' }
  await router.replace(targetLocation)
}

onMounted(async () => {
  try {
    await openUploadFolder()
  } catch (e) {
    console.error(e)
    errorMessage.value = $gettext('Uploading the shared files failed.')
  }
})

const headerTitle = computed(() => {
  if (unref(errorMessage)) {
    return $gettext('An error occurred')
  }
  return $gettext('Uploading shared files…')
})
</script>
