import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Fixa a raiz aqui pra o Turbopack não subir até um package-lock.json
  // de pastas acima.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
