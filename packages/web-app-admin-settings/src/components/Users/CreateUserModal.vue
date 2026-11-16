<template>
  <form autocomplete="off" @submit.prevent="$emit('confirm')">
    <oc-text-input
      id="create-user-input-user-name"
      v-model="user.onPremisesSamAccountName"
      class="mb-2"
      :label="$gettext('User name')"
      :error-message="formData.userName.errorMessage"
      :fix-message-line="true"
      required-mark
      @update:model-value="validateUserName"
    />
    <oc-text-input
      id="create-user-input-display-name"
      v-model="user.displayName"
      class="mb-2"
      :label="$gettext('First and last name')"
      :error-message="formData.displayName.errorMessage"
      :fix-message-line="true"
      required-mark
      @update:model-value="validateDisplayName"
    />
    <oc-text-input
      id="create-user-input-email"
      v-model="user.mail"
      class="mb-2"
      :label="$gettext('Email')"
      :error-message="formData.email.errorMessage"
      :error-message-debounced-time="1000"
      type="email"
      :fix-message-line="true"
      required-mark
      @update:model-value="validateEmail"
    />
    <oc-text-input
      v-if="!isExternalAuthDirectory"
      id="create-user-input-password"
      v-model="user.passwordProfile.password"
      autocomplete="new-password"
      class="mb-2"
      :label="$gettext('Password')"
      :error-message="formData.password.errorMessage"
      type="password"
      :fix-message-line="true"
      required-mark
      @update:model-value="validatePassword"
    />
    <div v-if="authDirectoryOptions.length > 1" class="mb-2">
      <oc-select
        id="create-user-input-auth-directory"
        :model-value="selectedAuthDirectoryOption"
        :label="$gettext('Authentication source')"
        option-label="label"
        :options="authDirectoryOptions"
        :clearable="false"
        @update:model-value="onUpdateAuthDirectory"
      />
      <div class="oc-text-input-message">
        <span v-if="isExternalAuthDirectory">
          {{
            $gettext(
              'The password is verified against the external directory. The user name must match the account there.'
            )
          }}
        </span>
      </div>
      <div v-if="isExternalAuthDirectory" class="mb-2">
        <oc-button
          id="create-user-auth-directory-lookup"
          size="small"
          :disabled="authDirectoryLookupPending"
          @click="onLookupAuthDirectory"
        >
          {{ $gettext('Check user name in directory') }}
        </oc-button>
        <span v-if="authDirectoryLookupMessage" class="ml-2">{{ authDirectoryLookupMessage }}</span>
      </div>
    </div>
    <input type="submit" class="hidden" />
  </form>
</template>

<script lang="ts">
import { useGettext } from 'vue3-gettext'
import { computed, defineComponent, onMounted, PropType, ref, unref, watch } from 'vue'
import * as EmailValidator from 'email-validator'
import { Modal, useClientService, useMessages } from '@opencloud-eu/web-pkg'
import { useUserSettingsStore } from '../../composables/stores/userSettings'
import {
  useAuthDirectory,
  AuthDirectory,
  INTERNAL_AUTH_DIRECTORY
} from '../../composables/authDirectory/useAuthDirectory'

// randomPassword returns a strong random string for the idm entry of an
// externally-authenticated user. It is never used for login (the check is
// delegated to the external directory) and never shown.
function randomPassword(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)) + 'Aa1!'
}

export default defineComponent({
  name: 'CreateUserModal',
  props: { modal: { type: Object as PropType<Modal>, required: true } },
  emits: ['confirm', 'update:confirmDisabled'],
  setup(props, { emit, expose }) {
    const { showMessage, showErrorMessage } = useMessages()
    const clientService = useClientService()
    const { $gettext } = useGettext()
    const userSettingsStore = useUserSettingsStore()

    const formData = ref<Record<string, { errorMessage: string; valid: boolean }>>({
      userName: {
        errorMessage: '',
        valid: false
      },
      displayName: {
        errorMessage: '',
        valid: false
      },
      email: {
        errorMessage: '',
        valid: false
      },
      password: {
        errorMessage: '',
        valid: false
      }
    })

    const user = ref({
      onPremisesSamAccountName: '',
      displayName: '',
      mail: '',
      passwordProfile: {
        password: ''
      }
    })

    const { listAuthDirectories, setUserAuthDirectory, lookupUser } = useAuthDirectory()
    const authDirectories = ref<AuthDirectory[]>([])
    const authDirectory = ref<string>(INTERNAL_AUTH_DIRECTORY)
    const authDirectoryLookupPending = ref(false)
    const authDirectoryLookupMessage = ref('')

    const isExternalAuthDirectory = computed(() => unref(authDirectory) !== INTERNAL_AUTH_DIRECTORY)
    const authDirectoryOptions = computed(() => unref(authDirectories))
    const selectedAuthDirectoryOption = computed(() =>
      unref(authDirectories).find((d) => d.name === unref(authDirectory))
    )

    onMounted(async () => {
      try {
        authDirectories.value = await listAuthDirectories()
      } catch (error) {
        console.error(error)
      }
    })

    const isFormInvalid = computed(() => {
      return Object.keys(unref(formData))
        .filter((k) => k !== 'password' || !unref(isExternalAuthDirectory))
        .map((k) => !!unref(formData)[k].valid)
        .includes(false)
    })

    watch(
      isFormInvalid,
      () => {
        emit('update:confirmDisabled', unref(isFormInvalid))
      },
      { immediate: true }
    )

    const onConfirm = async () => {
      if (unref(isFormInvalid)) {
        return Promise.reject()
      }

      try {
        const client = clientService.graphAuthenticated
        if (unref(isExternalAuthDirectory)) {
          // The idm entry still needs a password, but it is never used: the
          // password check is delegated to the external directory. Set a strong
          // random one so nobody can authenticate against idm for this user.
          user.value.passwordProfile.password = randomPassword()
        }
        const { id: createdUserId } = await client.users.createUser(unref(user))
        if (unref(isExternalAuthDirectory)) {
          await setUserAuthDirectory(createdUserId, unref(authDirectory))
        }
        const createdUser = await client.users.getUser(createdUserId)
        showMessage({ title: $gettext('User was created successfully') })
        userSettingsStore.upsertUser(createdUser)
      } catch (error) {
        console.error(error)
        showErrorMessage({
          title: $gettext('Failed to create user'),
          errors: [error]
        })
      }
    }

    expose({ onConfirm })

    return {
      clientService,
      formData,
      user,
      isFormInvalid,
      authDirectory,
      authDirectoryOptions,
      selectedAuthDirectoryOption,
      isExternalAuthDirectory,
      authDirectoryLookupPending,
      authDirectoryLookupMessage,
      lookupUser,

      // unit tests
      onConfirm
    }
  },
  methods: {
    onUpdateAuthDirectory(option: AuthDirectory) {
      this.authDirectory = option?.name || INTERNAL_AUTH_DIRECTORY
      this.authDirectoryLookupMessage = ''
    },
    async onLookupAuthDirectory() {
      const login = this.user.onPremisesSamAccountName
      if (!this.isExternalAuthDirectory || !login) {
        return
      }
      this.authDirectoryLookupPending = true
      this.authDirectoryLookupMessage = ''
      try {
        const exists = await this.lookupUser(this.authDirectory, login)
        this.authDirectoryLookupMessage = exists
          ? this.$gettext('User name found in directory.')
          : this.$gettext('User name NOT found in directory.')
      } catch {
        this.authDirectoryLookupMessage = this.$gettext('Could not reach the directory.')
      } finally {
        this.authDirectoryLookupPending = false
      }
    },
    async validateUserName() {
      if (this.user.onPremisesSamAccountName.trim() === '') {
        this.formData.userName.errorMessage = this.$gettext('User name cannot be empty')
        this.formData.userName.valid = false
        return false
      }

      if (this.user.onPremisesSamAccountName.includes(' ')) {
        this.formData.userName.errorMessage = this.$gettext('User name cannot contain white spaces')
        this.formData.userName.valid = false
        return false
      }

      if (this.user.onPremisesSamAccountName.length > 255) {
        this.formData.userName.errorMessage = this.$gettext(
          'User name cannot exceed 255 characters'
        )
        this.formData.userName.valid = false
        return false
      }

      // validate username against regex
      // shouldn't contain special characters except . and _
      // shouldn't start with a number
      // matching regex from server side
      const pattern =
        "^[a-zA-Z_][a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]*(@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)*$"
      if (!new RegExp(pattern).test(this.user.onPremisesSamAccountName)) {
        this.formData.userName.errorMessage = this.$gettext(
          'User name cannot contain special characters'
        )
        this.formData.userName.valid = false
        return false
      }

      if (
        this.user.onPremisesSamAccountName.length &&
        !isNaN(parseInt(this.user.onPremisesSamAccountName[0]))
      ) {
        this.formData.userName.errorMessage = this.$gettext('User name cannot start with a number')
        this.formData.userName.valid = false
        return false
      }

      try {
        // Validate username by fetching the user. If the request succeeds, we throw a validation error
        const client = this.clientService.graphAuthenticated
        await client.users.getUser(this.user.onPremisesSamAccountName)
        this.formData.userName.errorMessage = this.$gettext('User "%{userName}" already exists', {
          userName: this.user.onPremisesSamAccountName
        })
        this.formData.userName.valid = false
        return false
      } catch {}

      this.formData.userName.errorMessage = ''
      this.formData.userName.valid = true
      return true
    },
    validateDisplayName() {
      this.formData.displayName.valid = false

      if (this.user.displayName.trim() === '') {
        this.formData.displayName.errorMessage = this.$gettext(
          'First and last name cannot be empty'
        )
        return false
      }

      if (this.user.displayName.length > 255) {
        this.formData.displayName.errorMessage = this.$gettext(
          'First and last name cannot exceed 255 characters'
        )
        return false
      }

      this.formData.displayName.errorMessage = ''
      this.formData.displayName.valid = true
      return true
    },
    validateEmail() {
      this.formData.email.valid = false

      if (!EmailValidator.validate(this.user.mail)) {
        this.formData.email.errorMessage = this.$gettext('Please enter a valid email')
        return false
      }

      this.formData.email.errorMessage = ''
      this.formData.email.valid = true
      return true
    },
    validatePassword() {
      this.formData.password.valid = false

      if (this.user.passwordProfile.password.trim() === '') {
        this.formData.password.errorMessage = this.$gettext('Password cannot be empty')
        return false
      }

      this.formData.password.errorMessage = ''
      this.formData.password.valid = true
      return true
    }
  }
})
</script>
