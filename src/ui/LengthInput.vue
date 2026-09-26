<script setup lang="ts">
// Text input for a length in metres. Shows it formatted in the user's units; accepts "3.5", "350cm", 11'3" …
import { ref, watch } from 'vue'
import { format, parse } from '@/editor/units'
import { store } from '@/editor/store'

const props = defineProps<{ modelValue: number; min?: number; max?: number; size?: 'xs' | 'sm' | 'md' }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const text = ref('')
const invalid = ref(false)
const show = () => (text.value = format(props.modelValue, store.settings.units))
watch(() => [props.modelValue, store.settings.units], show, { immediate: true })

function commit() {
  const v = parse(text.value, store.settings.units)
  if (v === null || (props.min !== undefined && v < props.min) || (props.max !== undefined && v > props.max)) {
    invalid.value = true
    return
  }
  invalid.value = false
  if (v !== props.modelValue) emit('update:modelValue', v)
  show()
}
</script>

<template>
  <UInput
    v-model="text"
    :size="size ?? 'sm'"
    :color="invalid ? 'error' : undefined"
    :highlight="invalid"
    @blur="commit"
    @keydown.enter="($event.target as HTMLInputElement).blur()"
    @keydown.esc="(invalid = false), show()"
  />
</template>
