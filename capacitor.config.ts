import type { CapacitorConfig } from "@capacitor/cli";

// App da App Store e do Google Play: abre o próprio site (server.url) dentro do app, com os recursos
// do celular por cima (lembretes, salvar/compartilhar PDF, câmera e localização com permissão).
// Mudança no site aparece no app sem mandar versão nova para as lojas.
// appId é definitivo depois da 1ª publicação: confirmar com a Lux antes de enviar.
const URL_APP = process.env.CAP_SERVER_URL || "https://sejaseuguia-production.up.railway.app";

const config: CapacitorConfig = {
  appId: "br.com.luxviagens.sejaseuguia",
  appName: "Seja Seu Guia",
  webDir: "mobile/www",
  server: {
    url: URL_APP,
    // Sem internet ou servidor fora: tela própria do app em vez da página de erro do navegador.
    errorPath: "erro.html",
    androidScheme: "https",
  },
  // Marca no user agent para o site saber que está dentro do app.
  appendUserAgent: "SejaSeuGuiaApp",
  backgroundColor: "#101B3B",
  ios: { contentInset: "never", limitsNavigationsToAppBoundDomains: false },
  plugins: {
    SplashScreen: { launchShowDuration: 3000, launchAutoHide: false, backgroundColor: "#101B3B", showSpinner: false },
    LocalNotifications: { smallIcon: "ic_stat_notify", iconColor: "#F5B700" },
  },
};

export default config;
