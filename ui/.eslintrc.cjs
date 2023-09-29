module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  ignorePatterns: ["dist", "ui/node_modules", "*.config.js"],
  parser: "vue-eslint-parser",
  parserOptions: {
    parser: {
      // Script parser for `<script lang="ts">`
      ts: "@typescript-eslint/parser",

      // Script parser for `<script>`
      js: "espree",

      // Script parser for vue directives (e.g. `v-if=` or `:attribute=`)
      // and vue interpolations (e.g. `{{variable}}`).
      // If not specified, the parser determined by `<script lang ="...">` is used.
      "<template>": "@typescript-eslint/parser",
    },
  },
  extends: [
    "standard",
    "eslint:recommended",
    // "plugin:chai-friendly/recommended",
    "plugin:vue/vue3-recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:security-node/recommended",
    "plugin:anti-trojan-source/recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  plugins: [
    "anti-trojan-source",
    // "chai-friendly",
    "import",
    "security-node",
    "@typescript-eslint",
    "vue",
  ],
  rules: {
    // Common
    "no-console": "off",
    indent: ["error", 2],
    quotes: ["error", "double"],
    "comma-dangle": ["error", "always-multiline"],
    semi: ["error", "always"],
    "no-trailing-spaces": ["error", { ignoreComments: false }],
    "object-curly-spacing": ["error", "always"],
    "space-before-function-paren": ["error", "never"],
    "arrow-parens": ["error", "always"],

    "@typescript-eslint/no-explicit-any": "warn",

    "import/order": ["error", {
      "newlines-between": "always-and-inside-groups",
      alphabetize: {
        order: "asc",
      },
    }],

    // Vue
    "vue/script-indent": ["error", 2],
    "vue/component-tags-order": ["error", {
      order: ["script", "template", "style"],
    }],
    "vue/block-tag-newline": ["error", {
      singleline: "always",
      multiline: "always",
    }],
    "vue/max-attributes-per-line": ["error", {
      singleline: {
        max: 1,
      },
      multiline: {
        max: 1,
      },
    }],
    "vue/multi-word-component-names": ["error", {
      ignores: [],
    }],
    "vue/static-class-names-order": ["error"],
    "vue/attributes-order": ["error"],
  },
  overrides: [
    {
      files: ["*.vue"],
      rules: {
        indent: "off",
      },
    },
  ],
};
