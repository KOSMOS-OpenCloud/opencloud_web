<template>
  <div class="oc-link-resolve h-screen flex flex-col justify-center items-center p-4">
    <oc-card
      :title="headerTitle"
      body-class="text-center"
      header-class="text-center"
      class="w-auto md:w-lg rounded-lg"
    >
      <template v-if="uploadTask.isRunning">
        <oc-spinner :aria-hidden="true" />
        <p v-if="totalCount" class="mt-2" v-text="progressMessage" />
      </template>
      <p v-else-if="errorMessage" data-testid="error-message" class="text-xl">
        {{ errorMessage }}
      </p>
    </oc-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, unref, watch } from 'vue'
import { useTask } from 'vue-concurrency'
import { useGettext } from 'vue3-gettext'
import {
  createFileRouteOptions,
  createLocationSpaces,
  resolveFileNameDuplicate,
  useClientService,
  useRouter,
  useSpacesStore
} from '@opencloud-eu/web-pkg'
import { HttpError, Resource, SpaceResource } from '@opencloud-eu/web-client'
import { deleteSharedFile, readSharedFiles } from '../helpers/shareUploaded'

const UPLOAD_FOLDER = '/Uploaded'

const router = useRouter()
const { $gettext } = useGettext()
const clientService = useClientService()
const spacesStore = useSpacesStore()

const totalCount = ref(0)
const uploadedCount = ref(0)
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

async function ensureUploadFolder(personalSpace: SpaceResource): Promise<Resource[]> {
  const { webdav } = clientService
  try {
    const { children } = await webdav.listFiles(personalSpace, { path: UPLOAD_FOLDER })
    return children
  } catch (e) {
    if (!(e instanceof HttpError) || e.statusCode !== 404) {
      throw e
    }
  }
  await webdav.createFolder(personalSpace, { path: UPLOAD_FOLDER, fetchFolder: false })
  return []
}

function fileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex > 0 ? fileName.slice(dotIndex + 1) : ''
}

const uploadTask = useTask(function* () {
  yield waitForSpaces()
  const personalSpace = spacesStore.personalSpace
  if (!personalSpace) {
    throw new Error($gettext('Personal space not found'))
  }

  const sharedFiles: Awaited<ReturnType<typeof readSharedFiles>> = yield readSharedFiles()
  totalCount.value = sharedFiles.length

  const existingResources: Resource[] = yield ensureUploadFolder(personalSpace)
  const { webdav } = clientService

  for (const { key, file } of sharedFiles) {
    let targetName = file.name || 'shared'
    if (existingResources.some((resource) => resource.name === targetName)) {
      targetName = resolveFileNameDuplicate(
        targetName,
        fileExtension(targetName),
        existingResources
      )
    }
    const content: ArrayBuffer = yield file.arrayBuffer()
    const uploadedResource: Resource = yield webdav.putFileContents(personalSpace, {
      path: `${UPLOAD_FOLDER}/${targetName}`,
      content,
      overwrite: false
    })
    existingResources.push(uploadedResource)
    yield deleteSharedFile(key)
    uploadedCount.value++
  }

  const uploadFolder: Resource = yield webdav.getFileInfo(personalSpace, { path: UPLOAD_FOLDER })
  const targetLocation = createLocationSpaces('files-spaces-generic')
  const { params, query } = createFileRouteOptions(personalSpace, {
    fileId: uploadFolder.fileId,
    path: UPLOAD_FOLDER
  })
  targetLocation.params = params
  targetLocation.query = query
  router.replace(targetLocation)
})

onMounted(async () => {
  try {
    await uploadTask.perform()
  } catch (e) {
    console.error(e)
    errorMessage.value = $gettext('Uploading the shared files failed.')
  }
})

const progressMessage = computed(() => {
  return $gettext('%{uploaded} of %{total} files uploaded', {
    uploaded: unref(uploadedCount).toString(),
    total: unref(totalCount).toString()
  })
})

const headerTitle = computed(() => {
  if (unref(errorMessage)) {
    return $gettext('An error occurred')
  }
  return $gettext('Uploading shared files…')
})
</script>
