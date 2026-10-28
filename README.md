# FIAT · Água em Ciclo

Experiência interativa sobre o ciclo industrial da água, com abertura FIAT cromada, narração profissional e enquadramentos que acompanham cada etapa.

## A experiência

- Abertura animada de aproximadamente três segundos com o SVG FIAT fornecido.
- Narração de aproximadamente 68 segundos; o áudio controla o tempo da animação.
- Close da fábrica desde o primeiro quadro, seguido de tanques, filtração, membranas, reúso e acompanhamento ambiental.
- Visão completa do circuito somente no encerramento.
- Zoom uniforme, arrasto, capítulos, pausa, retomada, reinício, controles de voz e trilha.
- Layout adaptável e respeito à preferência por movimento reduzido.

O navegador tenta iniciar voz e animação após a abertura. Se a política de áudio automático exigir interação, ambas aguardam o botão **Iniciar com áudio**.

## Executar localmente

Requer Node.js 20 ou mais recente. O projeto não tem dependências externas.

```sh
npm run check
npm run dev
```

Abra `http://localhost:4173`. Para gerar somente os arquivos de publicação:

```sh
npm run build
```

O resultado fica em `dist/` e pode ser hospedado em qualquer serviço de sites estáticos.

## Estrutura

```text
src/
  index.html       Página, ilustração e controles SVG
  styles.css       Estilos da página e do loading
  boot.js          Inicialização da abertura
  intro.js         Encerramento do loading
  app.js           Áudio, câmera e animação
assets/
  illustration.png Arte-base derivada da referência aprovada
  narration.mp3    Cinco gravações reunidas em uma faixa contínua
  fiat-logo.svg    Marca vetorial fornecida
scripts/
  build.mjs        Gera a pasta dist sem dependências
  check.mjs        Verifica fontes, recursos e sintaxe
  serve.mjs        Servidor local com suporte a áudio e busca por trecho
```

## Publicação

O workflow `.github/workflows/pages.yml` verifica, compila e publica no GitHub Pages quando a branch `main` é atualizada. Também pode ser executado manualmente na aba Actions.

## Alterar a experiência

A câmera e os tempos dos capítulos estão em `src/app.js`. Os efeitos da abertura estão em `src/styles.css`. O áudio e a arte são recursos locais do projeto; não há chamadas a APIs, credenciais, serviços de voz ou arquivos do computador do autor.

A ilustração de base é raster e mantém o acabamento da referência; as sobreposições de animação e o logo do loading são SVG. A resolução da imagem limita a nitidez em ampliações grandes. O modelo é ilustrativo: níveis e tempos não são parâmetros operacionais de uma estação de tratamento.
