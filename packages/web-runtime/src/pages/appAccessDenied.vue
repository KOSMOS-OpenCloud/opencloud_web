<template>
  <no-content-message icon="lock" class="app-access-denied h-full">
    <template #message>
      <span v-text="$gettext('No access to this app')" />
    </template>
    <template #callToAction>
      <span v-text="$gettext('This app is limited to the members of certain groups.')" />
    </template>
  </no-content-message>
</template>
<script setup lang="ts">
import { NoContentMessage } from '@opencloud-eu/web-pkg'
</script>
