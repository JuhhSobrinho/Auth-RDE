import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Servido como project page no GitHub Pages, em
  // https://juhhsobrinho.github.io/Auth-RDE/ — sem isso (base "/" padrão),
  // o dist/index.html referencia os assets a partir da raiz do domínio
  // (/assets/...) em vez de /Auth-RDE/assets/..., e a página carrega em
  // branco com 404 nos .js/.css. Se o repositório for renomeado, atualizar
  // esse valor junto.
  base: '/Auth-RDE/',
})
