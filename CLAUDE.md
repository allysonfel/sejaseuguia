@AGENTS.md

## Regra: assistente sempre atualizado

Toda implementação que muda o que o viajante vê ou faz (tela nova, botão, fluxo, nome de algo, comportamento) atualiza, no MESMO commit, o que o assistente (Gui) sabe do app, em `src/lib/guiaApp.ts`:
- `GUIA`: texto das telas que vai para a IA. Descrever a novidade onde ela fica.
- `FAQ`: respostas prontas (sem IA). Ajustar a resposta que ficou desatualizada e criar entrada quando a novidade gera dúvida de "como faço".
- `TELAS`: quando surgir tela nova para onde o assistente possa levar.

Antes de fechar, conferir se alguma resposta pronta ou trecho do `GUIA` cita algo que mudou (nome de botão, cor, lugar na tela).
