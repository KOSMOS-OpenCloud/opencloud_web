<template>
  <div v-show="activeJobCount > 0" id="oc-job-status" class="flex">
    <oc-button
      id="oc-job-status-btn"
      v-oc-tooltip="activeJobCount + ' ' + $gettext('Jobs aktiv')"
      appearance="raw-inverse"
      color-role="chrome"
      :aria-label="activeJobCount + ' ' + $gettext('Jobs aktiv')"
      no-hover
      class="relative"
      @click="fetchJobs"
    >
      <oc-icon class="cursor-pointer flex items-center" name="loader-4" fill-type="line" />
      <span
        class="badge absolute top-[-6px] right-[-9px] p-1 text-xs leading-2 font-light text-center bg-blue-600 text-white rounded-4xl box-content min-w-2 h-2 shadow-sm"
        v-text="activeJobCount > 99 ? '99+' : activeJobCount"
      />
    </oc-button>
    <oc-drop
      drop-id="oc-job-status-drop"
      toggle="#oc-job-status-btn"
      mode="click"
      class="w-64 max-w-full max-h-[300px] overflow-y-auto"
      :options="{ pos: 'bottom-right', delayHide: 0 }"
      padding-size="small"
      :is-menu="false"
    >
      <span v-if="!jobs.length" class="text-sm" v-text="$gettext('Laden...')" />
      <ul v-else class="list-none p-0 m-0">
        <li v-for="job in jobs" :key="job.jobId" class="py-1.5 border-b last:border-b-0 border-role-chrome/10">
          <div class="text-sm">
            <strong>{{ job.pipeline }}</strong>
            <span v-if="job.filename" class="text-role-on-surface-variant"> · {{ job.filename }}</span>
          </div>
          <div class="text-xs text-role-on-surface-variant">
            {{ job.status }}<span v-if="job.progress > 0"> · {{ job.progress }}%</span>
          </div>
          <oc-button
            appearance="raw"
            no-hover
            size="small"
            :aria-label="$gettext('Abbrechen')"
            @click.stop="cancelJob(job.jobId)"
          >
            <oc-icon name="close" size="small" />
          </oc-button>
        </li>
      </ul>
    </oc-drop>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { activeJobCount, useJobService } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'

const { $gettext } = useGettext()
const jobService = useJobService()

interface JobItem {
  jobId: string
  pipeline: string
  filename: string
  status: string
  progress: number
}

const jobs = ref<JobItem[]>([])

const fetchJobs = async () => {
  try {
    const all = await jobService.listJobs()
    jobs.value = all
      .filter((j: any) => j.status === 'running' || j.status === 'queued')
      .map((j: any) => ({
        jobId: j.jobId,
        pipeline: j.pipeline,
        filename: j.params?.origin_filename || j.params?.repo || '',
        status: j.status,
        progress: j.progress || 0
      }))
  } catch (e) {
    console.error('JobStatus fetch failed', e)
  }
}

const cancelJob = async (jobId: string) => {
  try {
    await jobService.cancelJob(jobId)
    jobs.value = jobs.value.filter((j) => j.jobId !== jobId)
  } catch {
    // ignore
  }
}

const statusIcon = (status: string) => {
  if (status === 'running') return 'loader-4'
  if (status === 'queued') return 'time'
  return 'check'
}
</script>
