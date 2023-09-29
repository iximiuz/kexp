<!-- eslint-disable import/order -->
<script lang="ts">
import Prism from "prismjs";
import "prismjs/plugins/line-numbers/prism-line-numbers.css";
import "prismjs/plugins/line-numbers/prism-line-numbers.js";
// import "prismjs/themes/prism.min.css";  // standard (light) theme
// import "prismjs/themes/prism-okaidia.min.css";  // ok-ish dark theme
// import "prismjs/themes/prism-twilight.min.css"; // ok-ish dark theme
import "prismjs/themes/prism-tomorrow.min.css"; // ok-ish dark theme
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
</script>

<!-- eslint-disable import/order -->
<script lang="ts" setup>
// eslint-disable-next-line import/namespace
import { CodeJar } from "codejar";
import { onMounted, ref, watch } from "vue";

const props = defineProps({
  code: { type: String, default: "" },
  editable: { type: Boolean, default: false },
});

const emit = defineEmits(["codeChange"]);

const editor = ref(null as HTMLElement | null);

let jar = null as CodeJar | null;

watch(() => props.code, (code) => {
  if (jar) {
    jar.updateCode(code);
  }
});

onMounted(() => {
  Prism.manual = true;

  // const highlight = (editor) => {
  //   editor.innerHTML = Prism.highlight(editor.textContent, Prism.languages.yaml, "yaml");
  //   Prism.highlightAll();
  // };
  jar = CodeJar(editor.value!, (elem) => Prism.highlightElement(elem), {
    tab: "  ",
  });
  jar.updateCode(props.code);

  jar.onUpdate((code) => {
    emit("codeChange", code);
  });

  if (!props.editable) {
    editor.value!.setAttribute("contenteditable", "false");
  }
});
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line -->
  <pre class="!my-0 box-border h-full language-yaml line-numbers scrollbar-styled"><code ref="editor" class="editor language-yaml line-numbers scrollbar-styled" /></pre>
</template>

<style scoped>
.editor {
  font-family: "Source Code Pro", monospace;
  font-size: 15px;
  font-weight: normal;
  letter-spacing: normal;
  tab-size: 2;
  white-space: pre !important;
  overflow-x: auto !important;
}
</style>
