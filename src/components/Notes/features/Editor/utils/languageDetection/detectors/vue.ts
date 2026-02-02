import type { LanguageDetector } from '../types';

export const detectVue: LanguageDetector = (ctx) => {
  const { code, first100Lines, sample } = ctx;

  const hasTemplate = /<template[\s>]/.test(sample);
  const hasScript = /<script[\s>]/.test(sample);
  const hasStyle = /<style[\s>]/.test(sample);

  if ((hasTemplate && hasScript) || (hasTemplate && hasStyle) || (hasScript && hasStyle)) {
    return 'vue';
  }

  if (/\s(v-if|v-for|v-model|v-bind|v-on|v-class|@click|@\w+|:class|:style|:\w+)=["']/.test(code)) {

    const directiveCount = (code.match(/\s(v-if|v-for|v-model|v-bind|v-on|v-class|@\w+|:\w+)=/g) || []).length;
    if (directiveCount >= 1 && /<template[\s>]/.test(sample)) {
      return 'vue';
    }
  }

  if (/\b(defineComponent|defineProps|defineEmits|ref|reactive|computed|watch|onMounted)\b/.test(first100Lines)) {
    if (/<template[\s>]|<script setup>/.test(code)) {
      return 'vue';
    }
  }

  if (/<script\s+setup[\s>]/.test(code)) {
    return 'vue';
  }

  return null;
};
