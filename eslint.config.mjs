import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const config = [
  {
    // next-env.d.ts do Next sinh ra, không sửa được và không tuân quy tắc lint.
    ignores: ['.next/**', 'node_modules/**', 'src/generated/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]

export default config
