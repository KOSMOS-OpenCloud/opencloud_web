<template>
  <div id="user-edit-panel">
    <UserInfoBox :user="user" />
    <form id="user-edit-form" class="bg-role-surface-container p-4 rounded-sm" autocomplete="off">
      <div>
        <oc-text-input
          id="userName-input"
          v-model="editUser.onPremisesSamAccountName"
          class="mb-2"
          :label="$gettext('User name')"
          :error-message="formData.userName.errorMessage"
          :fix-message-line="true"
          :read-only="
            isInputFieldReadOnly('user.onPremisesSamAccountName') || isExternalAuthDirectory
          "
          required-mark
          @update:model-value="validateUserName"
        />
        <oc-text-input
          id="displayName-input"
          v-model="editUser.displayName"
          class="mb-2"
          :label="$gettext('First and last name')"
          :error-message="formData.displayName.errorMessage"
          :fix-message-line="true"
          :read-only="isInputFieldReadOnly('user.displayName')"
          required-mark
          @update:model-value="validateDisplayName"
        />
        <oc-text-input
          id="email-input"
          v-model="editUser.mail"
          class="mb-2"
          :label="$gettext('Email')"
          :error-message="formData.email.errorMessage"
          :error-message-debounced-time="1000"
          type="email"
          :fix-message-line="true"
          :read-only="isInputFieldReadOnly('user.mail')"
          required-mark
          @update:model-value="validateEmail"
        />
        <oc-text-input
          id="password-input"
          :model-value="editUser.passwordProfile?.password"
          class="mb-2"
          :label="$gettext('Password')"
          type="password"
          :fix-message-line="true"
          placeholder="●●●●●●●●"
          :read-only="isInputFieldReadOnly('user.passwordProfile')"
          @update:model-value="onUpdatePassword"
        />
        <div class="mb-2">
          <oc-select
            id="role-input"
            :model-value="selectedRoleValue"
            :label="$gettext('Role')"
            option-label="displayName"
            :options="translatedRoleOptions"
            :clearable="false"
            :read-only="isInputFieldReadOnly('user.appRoleAssignments')"
            required-mark
            @update:model-value="onUpdateRole"
          />
          <div class="oc-text-input-message"></div>
        </div>
        <div v-if="!graphUsersEditLoginAllowedDisabled" class="mb-2">
          <oc-select
            id="login-input"
            :disabled="isLoginInputDisabled"
            :model-value="selectedLoginValue"
            :label="$gettext('Login')"
            :options="loginOptions"
            :clearable="false"
            :read-only="isInputFieldReadOnly('user.accountEnabled')"
            required-mark
            @update:model-value="onUpdateLogin"
          />

          <div class="oc-text-input-message"></div>
        </div>
        <div v-if="authDirectoryOptions.length > 1" class="mb-2">
          <oc-select
            id="auth-directory-input"
            :model-value="selectedAuthDirectoryOption"
            :label="$gettext('Authentication source')"
            option-label="label"
            :options="authDirectoryOptions"
            :clearable="false"
            :read-only="isInputFieldReadOnly('user.onPremisesSamAccountName')"
            @update:model-value="onUpdateAuthDirectory"
          />
          <div class="oc-text-input-message">
            <span v-if="isExternalAuthDirectory">
              {{
                $gettext(
                  'The password is verified against the external directory. The user name must match the account there and cannot be changed.'
                )
              }}
            </span>
          </div>
          <div v-if="isExternalAuthDirectory" class="mb-2">
            <oc-button
              id="auth-directory-lookup"
              size="small"
              :disabled="authDirectoryLookupPending"
              @click="onLookupAuthDirectory"
            >
              {{ $gettext('Check user name in directory') }}
            </oc-button>
            <span v-if="authDirectoryLookupMessage" class="ml-2">{{
              authDirectoryLookupMessage
            }}</span>
          </div>
        </div>
        <quota-select
          id="quota-select-form"
          :key="'quota-select-' + user.id"
          :disabled="isQuotaInputDisabled"
          class="mb-2"
          :label="$gettext('Personal quota')"
          :total-quota="editUser.drive?.quota?.total || 0"
          :max-quota="maxQuota"
          :fix-message-line="true"
          :description-message="
            isQuotaInputDisabled && !isInputFieldReadOnly('drive.quota')
              ? $gettext('To set an individual quota, the user needs to have logged in once.')
              : ''
          "
          :read-only="isInputFieldReadOnly('drive.quota')"
          required-mark
          @selected-option-change="changeSelectedQuotaOption"
        />
        <group-select
          class="mb-2"
          :read-only="isInputFieldReadOnly('user.memberOf')"
          :selected-groups="editUser.memberOf"
          :group-options="groupOptions"
          @selected-option-change="changeSelectedGroupOption"
        />
      </div>
      <compare-save-dialog
        class="mb-6"
        :original-object="compareSaveDialogOriginalObject"
        :compare-object="editUser"
        :confirm-button-disabled="invalidFormData"
        @revert="revertChanges"
        @confirm="onEditUser({ user, editUser })"
      ></compare-save-dialog>
    </form>
  </div>
</template>
<script lang="ts">
import { computed, defineComponent, PropType, ref, unref, watch } from 'vue'
import * as EmailValidator from 'email-validator'
import {
  CompareSaveDialog,
  QuotaSelect,
  useUserStore,
  useCapabilityStore,
  useEventBus,
  useMessages,
  useSpacesStore,
  useAuthService
} from '@opencloud-eu/web-pkg'
import GroupSelect from '../GroupSelect.vue'
import { cloneDeep, isEmpty, isEqual, omit } from 'lodash-es'
import { AppRole, AppRoleAssignment, Group, User } from '@opencloud-eu/web-client/graph/generated'
import { MaybeRef, useClientService } from '@opencloud-eu/web-pkg'
import { storeToRefs } from 'pinia'
import { diff } from 'deep-object-diff'
import { useUserSettingsStore } from '../../../composables/stores/userSettings'
import {
  useAuthDirectory,
  AuthDirectory,
  INTERNAL_AUTH_DIRECTORY
} from '../../../composables/authDirectory/useAuthDirectory'
import { useGettext } from 'vue3-gettext'

// EditableUser adds the OpenCore per-user auth directory. It is not part of the
// generated graph User model and is saved via its own endpoint (see onEditUser),
// following the same pattern as drive/appRoleAssignments/memberOf.
type EditableUser = User & { authDirectory?: string }

export default defineComponent({
  name: 'EditPanel',
  components: {
    CompareSaveDialog,
    QuotaSelect,
    GroupSelect
  },
  props: {
    user: {
      type: Object as PropType<User>,
      required: false,
      default: null
    },
    roles: {
      type: Array as PropType<AppRole[]>,
      required: true
    },
    groups: {
      type: Array as PropType<Group[]>,
      required: true
    },
    applicationId: {
      type: String,
      required: true
    }
  },
  emits: ['confirm'],
  setup(props) {
    const capabilityStore = useCapabilityStore()
    const capabilityRefs = storeToRefs(capabilityStore)
    const clientService = useClientService()
    const userStore = useUserStore()
    const userSettingsStore = useUserSettingsStore()
    const spacesStore = useSpacesStore()
    const eventBus = useEventBus()
    const { showErrorMessage } = useMessages()
    const { $gettext } = useGettext()
    const authService = useAuthService()
    const { graphUsersEditLoginAllowedDisabled } = storeToRefs(capabilityStore)
    const editUser: MaybeRef<EditableUser> = ref()
    const { listAuthDirectories, getUserAuthDirectory, setUserAuthDirectory, lookupUser } =
      useAuthDirectory()
    const authDirectories = ref<AuthDirectory[]>([])
    const originalAuthDirectory = ref<string>(INTERNAL_AUTH_DIRECTORY)
    const authDirectoryLookupPending = ref(false)
    const authDirectoryLookupMessage = ref('')
    const formData = ref({
      displayName: {
        errorMessage: '',
        valid: true
      },
      userName: {
        errorMessage: '',
        valid: true
      },
      email: {
        errorMessage: '',
        valid: true
      }
    })
    const groupOptions = computed(() => {
      const { memberOf: selectedGroups } = unref(editUser)
      return props.groups.filter(
        (g) => !selectedGroups.some((s) => s.id === g.id) && !g.groupTypes?.includes('ReadOnly')
      )
    })
    const isLoginInputDisabled = computed(() => userStore.user.id === (props.user as User).id)
    const isInputFieldReadOnly = (key: string) => {
      return capabilityStore.graphUsersReadOnlyAttributes.includes(key)
    }

    const isExternalAuthDirectory = computed(() => {
      const dir = (unref(editUser) as EditableUser)?.authDirectory
      return !!dir && dir !== INTERNAL_AUTH_DIRECTORY
    })

    // Load the auth directory for the selected user. The panel is reused across
    // users (the user prop changes), so this reacts to the id, not just mount.
    watch(
      () => (props.user as User)?.id,
      async (id) => {
        if (!id) {
          return
        }
        authDirectoryLookupMessage.value = ''
        if (!unref(authDirectories).length) {
          try {
            authDirectories.value = await listAuthDirectories()
          } catch (error) {
            console.error(error)
            return
          }
        }
        // Only relevant when at least one external directory is configured next to
        // the built-in "internal" entry.
        if (unref(authDirectories).length <= 1) {
          return
        }
        try {
          const current = await getUserAuthDirectory(id)
          originalAuthDirectory.value = current
          if (unref(editUser)) {
            ;(unref(editUser) as EditableUser).authDirectory = current
          }
        } catch (error) {
          console.error(error)
        }
      },
      { immediate: true }
    )

    const onUpdateUserAppRoleAssignments = (user: User, editUser: User) => {
      const client = clientService.graphAuthenticated
      return client.users.createUserAppRoleAssignment(user.id, {
        appRoleId: editUser.appRoleAssignments[0].appRoleId,
        resourceId: props.applicationId,
        principalId: editUser.id
      })
    }
    const onUpdateUserGroupAssignments = (user: User, editUser: User) => {
      const client = clientService.graphAuthenticated
      const groupsToAdd = editUser.memberOf.filter(
        (editUserGroup) => !user.memberOf.some((g) => g.id === editUserGroup.id)
      )
      const groupsToDelete = user.memberOf.filter(
        (editUserGroup) => !editUser.memberOf.some((g) => g.id === editUserGroup.id)
      )
      const requests = []

      for (const groupToAdd of groupsToAdd) {
        requests.push(client.groups.addMember(groupToAdd.id, user.id))
      }
      for (const groupToDelete of groupsToDelete) {
        requests.push(client.groups.deleteMember(groupToDelete.id, user.id))
      }

      return Promise.all(requests)
    }

    const onUpdateUserDrive = async (editUser: User) => {
      const client = clientService.graphAuthenticated
      const updateSpace = await client.drives.updateDrive(editUser.drive.id, {
        quota: { total: editUser.drive.quota.total }
      })

      if (editUser.id === userStore.user.id) {
        // Load current user quota
        spacesStore.updateSpaceField({
          id: editUser.drive.id,
          field: 'spaceQuota',
          value: updateSpace.spaceQuota
        })
      }
    }

    const onEditUser = async ({ user, editUser }: { user: User; editUser: User }) => {
      try {
        const client = clientService.graphAuthenticated
        const graphEditUserPayloadExtractor = (user: User) => {
          return omit(user, ['drive', 'appRoleAssignments', 'memberOf', 'authDirectory'])
        }
        const graphEditUserPayload = diff(
          graphEditUserPayloadExtractor(user),
          graphEditUserPayloadExtractor(editUser)
        ) as User

        if (!isEmpty(graphEditUserPayload)) {
          await client.users.editUser(editUser.id, graphEditUserPayload)
        }

        if (!isEqual(user.drive?.quota?.total, editUser.drive?.quota?.total)) {
          await onUpdateUserDrive(editUser)
        }

        if (!isEqual(user.memberOf, editUser.memberOf)) {
          await onUpdateUserGroupAssignments(user, editUser)
        }

        if (
          !isEqual(user.appRoleAssignments[0]?.appRoleId, editUser.appRoleAssignments[0]?.appRoleId)
        ) {
          await onUpdateUserAppRoleAssignments(user, editUser)
        }

        // The auth directory is an OpenCore per-user setting, saved via its own
        // endpoint (not part of the graph user payload).
        const editAuthDirectory = (editUser as EditableUser).authDirectory
        if (editAuthDirectory !== undefined && editAuthDirectory !== unref(originalAuthDirectory)) {
          await setUserAuthDirectory(user.id, editAuthDirectory)
          originalAuthDirectory.value = editAuthDirectory
        }

        // When the username of the current user changes, we need to obtain a new token
        if (
          editUser.id === user.id &&
          editUser.onPremisesSamAccountName !== user.onPremisesSamAccountName
        ) {
          await authService.signinSilent()
        }

        const updatedUser = await client.users.getUser(user.id)
        userSettingsStore.upsertUser(updatedUser)

        eventBus.publish('sidebar.entity.saved')

        if (userStore.user.id === updatedUser.id) {
          userStore.setUser(updatedUser)
        }

        return updatedUser
      } catch (error) {
        console.error(error)
        showErrorMessage({
          title: $gettext('Failed to edit user'),
          errors: [error]
        })
      }
    }

    return {
      maxQuota: capabilityRefs.spacesMaxQuota,
      isInputFieldReadOnly,
      isLoginInputDisabled,
      graphUsersEditLoginAllowedDisabled,
      editUser,
      formData,
      groupOptions,
      clientService,
      onEditUser,
      isExternalAuthDirectory,
      authDirectories,
      originalAuthDirectory,
      authDirectoryLookupPending,
      authDirectoryLookupMessage,
      lookupUser
    }
  },
  computed: {
    loginOptions() {
      return [
        {
          label: this.$gettext('Allowed'),
          value: true
        },
        {
          label: this.$gettext('Forbidden'),
          value: false
        }
      ]
    },
    selectedLoginValue() {
      return this.loginOptions.find((option) =>
        !('accountEnabled' in this.editUser)
          ? option.value === true
          : this.editUser.accountEnabled === option.value
      )
    },
    translatedRoleOptions() {
      return this.roles.map((role) => {
        return { ...role, displayName: this.$gettext(role.displayName) }
      })
    },
    selectedRoleValue() {
      const assignedRole = this.editUser?.appRoleAssignments?.[0]
      return this.translatedRoleOptions.find((role) => role.id === assignedRole?.appRoleId)
    },
    invalidFormData() {
      return Object.values(this.formData)
        .map((v) => !!v.valid)
        .includes(false)
    },
    showQuota() {
      return this.editUser.drive?.quota
    },
    isQuotaInputDisabled() {
      return typeof this.showQuota === 'undefined'
    },
    compareSaveDialogOriginalObject() {
      // Include the loaded auth directory so the save dialog only reports it as a
      // change once the admin actually picks a different source.
      return { ...cloneDeep(this.user), authDirectory: this.originalAuthDirectory }
    },
    authDirectoryOptions() {
      // The list already contains the built-in "internal" entry first.
      return this.authDirectories
    },
    selectedAuthDirectoryOption() {
      const current = (this.editUser as EditableUser)?.authDirectory || INTERNAL_AUTH_DIRECTORY
      return this.authDirectories.find((d) => d.name === current)
    }
  },
  watch: {
    user: {
      handler: function () {
        this.editUser = cloneDeep(this.user)
      },
      deep: true,
      immediate: true
    },
    editUser: {
      handler: function () {
        /**
         * Property accountEnabled won't be always set, but this still means, that login is allowed.
         * So we actually don't need to change the property if missing and not set to forbidden in the UI.
         * This also avoids the compare save dialog from displaying that there are unsaved changes.
         */
        if (this.editUser.accountEnabled === true && !('accountEnabled' in this.user)) {
          delete this.editUser.accountEnabled
        }
      },
      deep: true
    }
  },
  methods: {
    changeSelectedQuotaOption(option: { value: number; displayValue: string }) {
      this.editUser.drive.quota.total = option.value
    },
    changeSelectedGroupOption(option: Group[]) {
      this.editUser.memberOf = option
    },
    async validateUserName() {
      this.formData.userName.valid = false

      if (this.editUser.onPremisesSamAccountName.trim() === '') {
        this.formData.userName.errorMessage = this.$gettext('User name cannot be empty')
        return false
      }

      if (this.editUser.onPremisesSamAccountName.includes(' ')) {
        this.formData.userName.errorMessage = this.$gettext('User name cannot contain white spaces')
        return false
      }

      if (
        this.editUser.onPremisesSamAccountName.length &&
        !isNaN(parseInt(this.editUser.onPremisesSamAccountName[0]))
      ) {
        this.formData.userName.errorMessage = this.$gettext('User name cannot start with a number')
        return false
      }

      if (this.editUser.onPremisesSamAccountName.length > 255) {
        this.formData.userName.errorMessage = this.$gettext(
          'User name cannot exceed 255 characters'
        )
        return false
      }

      if (this.user.onPremisesSamAccountName !== this.editUser.onPremisesSamAccountName) {
        try {
          // Validate username by fetching the user. If the request succeeds, we throw a validation error
          const client = this.clientService.graphAuthenticated
          await client.users.getUser(this.editUser.onPremisesSamAccountName)
          this.formData.userName.errorMessage = this.$gettext('User "%{userName}" already exists', {
            userName: this.editUser.onPremisesSamAccountName
          })
          return false
        } catch {}
      }

      this.formData.userName.errorMessage = ''
      this.formData.userName.valid = true
      return true
    },
    validateDisplayName() {
      this.formData.displayName.valid = false

      if (this.editUser.displayName.trim() === '') {
        this.formData.displayName.errorMessage = this.$gettext(
          'First and last name cannot be empty'
        )
        return false
      }

      if (this.editUser.displayName.length > 255) {
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

      if (!EmailValidator.validate(this.editUser.mail)) {
        this.formData.email.errorMessage = this.$gettext('Please enter a valid email')
        return false
      }

      this.formData.email.errorMessage = ''
      this.formData.email.valid = true
      return true
    },
    revertChanges() {
      this.editUser = cloneDeep(this.user)
      Object.values(this.formData).forEach((formDataValue) => {
        formDataValue.valid = true
        formDataValue.errorMessage = ''
      })
    },
    onUpdateRole(role: AppRoleAssignment) {
      if (!this.editUser.appRoleAssignments.length) {
        // FIXME: Add resourceId and principalId to be able to remove type cast
        this.editUser.appRoleAssignments.push({
          appRoleId: role.id
        } as AppRoleAssignment)
        return
      }
      this.editUser.appRoleAssignments[0].appRoleId = role.id
    },
    onUpdatePassword(password: string) {
      this.editUser.passwordProfile = {
        password
      }
    },
    onUpdateLogin({ value }: { value: boolean }) {
      this.editUser.accountEnabled = value
    },
    onUpdateAuthDirectory(option: AuthDirectory) {
      ;(this.editUser as EditableUser).authDirectory = option?.name || INTERNAL_AUTH_DIRECTORY
      this.authDirectoryLookupMessage = ''
    },
    async onLookupAuthDirectory() {
      const directory = (this.editUser as EditableUser).authDirectory
      const login = this.editUser.onPremisesSamAccountName
      if (!directory || directory === INTERNAL_AUTH_DIRECTORY || !login) {
        return
      }
      this.authDirectoryLookupPending = true
      this.authDirectoryLookupMessage = ''
      try {
        const exists = await this.lookupUser(directory, login)
        this.authDirectoryLookupMessage = exists
          ? this.$gettext('User name found in directory.')
          : this.$gettext('User name NOT found in directory.')
      } catch {
        this.authDirectoryLookupMessage = this.$gettext('Could not reach the directory.')
      } finally {
        this.authDirectoryLookupPending = false
      }
    }
  }
})
</script>
