/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

const nextConfig = {
  reactStrictMode: true,
  // Statischer Export: die App besteht am Ende nur aus Dateien und braucht
  // keinen Server — dadurch läuft sie auf GitHub Pages ebenso wie überall sonst.
  output: 'export',
  // Auf GitHub Pages liegt alles unter /<repo>/; lokal bleibt der Pfad leer.
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  trailingSlash: true,
}

export default nextConfig
