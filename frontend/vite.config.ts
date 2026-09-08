import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Self-signed HTTPS in dev — camera access (QR scanning) requires a secure
  // context, and browsers don't treat a plain http://<lan-ip> origin as one.
  plugins: [react(), basicSsl()],
})
