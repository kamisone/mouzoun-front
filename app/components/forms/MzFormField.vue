<script setup lang="ts">
/**
 * Form field of the design system: UFormField (label ↔ input, error linked through
 * aria-describedby, validation from the UForm Zod schema) plus the project's conventions:
 * required star, translated "optional" hint.
 *
 * <UForm :schema="schema" :state="state" @submit="save">
 *   <MzFormField name="email" :label="t('auth.email')" required>
 *     <UInput v-model="state.email" type="email" autocomplete="email" />
 *   </MzFormField>
 * </UForm>
 */
const props = withDefaults(defineProps<{
  name: string
  label: string
  description?: string
  help?: string
  required?: boolean
  /** Shows "(optional)" next to the label for non-required fields. */
  markOptional?: boolean
}>(), { description: undefined, help: undefined, required: false, markOptional: false })

const { t } = useI18n()
const { size } = useDensity()
</script>

<template>
  <UFormField
    :name="props.name"
    :label="props.label"
    :description="props.description"
    :help="props.help"
    :required="props.required"
    :hint="!props.required && props.markOptional ? t('common.optional') : undefined"
    :size="size"
  >
    <slot />
  </UFormField>
</template>
