import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries into a separate chunk
          vendor: ['react', 'react-dom'],
          // Split Supabase into its own chunk (large library)
          supabase: ['@supabase/supabase-js'],
          // Split lucide icons into their own chunk
          icons: ['lucide-react'],
        },
      },
    },
    // Enable minification
    minify: 'esbuild',
    // Generate source maps for debugging (remove in production if bundle size is critical)
    sourcemap: false,
  },
})
