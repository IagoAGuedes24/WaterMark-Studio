# Watermark Studio 📸

Uma ferramenta web moderna, elegante e de alta performance desenvolvida para aplicação automatizada de marcas d'água e logos em lotes volumosos de fotos de eventos (suportando tranquilamente centenas ou mais de 2.000 fotos de câmera fotográfica por lote).

> 🌐 **Acesso Online (Sem Instalação):**  
> 👉 **[https://iagoaguedes24.github.io/watermark-studio/](https://iagoaguedes24.github.io/watermark-studio/)**

---

## ✨ Principais Diferenciais

- **Processamento 100% Local (Privacidade Total):** Suas fotos **não são enviadas para nenhum servidor externo**. Todo o processamento ocorre diretamente no hardware do seu computador via HTML5 Canvas e APIs nativas de arquivo.
- **Leveza e Desempenho em Lotes:** Utiliza a *File System Access API* para leitura e gravação sequencial direta no disco, permitindo processar milhares de arquivos sem acumular gigabytes na memória RAM.
- **Detecção de Orientação da Câmera (EXIF):** Reconhece automaticamente metadados de fotos tiradas na vertical (retrato) e na horizontal (paisagem), ajustando a rotação e aplicando a logo na posição correta em ambas.
- **Prévia Inteligente em Tempo Real:** Visualização interativa que carrega uma amostragem inicial das primeiras 10 fotos da pasta para testes rápidos antes do lote completo, evitando sobrecarga visual ou travamentos de memória.
- **Ajustes Visuais Finos:**
  - Grade de **9 posições predefinidas** (4 cantos, 4 laterais e centro).
  - Controle proporcional de tamanho (% da imagem), recuo de margem e opacidade/transparência.
  - Seletor de qualidade JPEG (Alta, Máxima para impressão ou Otimizada para web).
  - Renomeação opcional com sufixo personalizado (ex: `foto_logo.jpg`).

---

## 🖥️ Como Executar o Aplicativo

1. **Online via Navegador (Mais Prático):**
   * Basta acessar o link público: **[Watermark Studio Online](https://iagoaguedes24.github.io/watermark-studio/)** no Google Chrome ou Microsoft Edge.

2. **Localmente no Computador (Offline):**
   * **No Windows:** Dê dois cliques no arquivo **`iniciar_local.bat`** para abrir em `http://localhost:8080`.
   * **No Linux / WSL:** Execute `./iniciar_local.sh` ou `python3 -m http.server 8080`.

---

## 🎯 Fluxo de Operação

1. **Pastas no Computador:**
   - Clique em **"Selecionar Pasta com Fotos"** e aponte para a pasta com as fotos originais do evento.
   - Clique em **"Selecionar Pasta para Salvar"** e escolha a pasta de destino onde as fotos carimbadas serão gravadas.
2. **Marca d'Água:**
   - O app já inicia com uma logo de demonstração. Para usar a sua própria, clique na caixa da logo ou arraste seu arquivo de imagem (PNG com transparência ou SVG).
3. **Posicionamento & Estilo:**
   - Escolha o alinhamento desejado na grade de 9 botões (o padrão é o canto inferior direito ↘).
   - Ajuste o tamanho proporcional, a margem e a opacidade.
   - Use os botões **◀ Anterior** e **Próxima ▶** para alternar entre as 10 fotos de amostra e validar o visual tanto em fotos horizontais quanto verticais.
4. **Processamento do Lote:**
   - Clique em **"Iniciar Processamento do Lote"**.
   - Acompanhe a barra de progresso em tempo real com contador de fotos, velocidade de processamento (`fotos/s`) e estimativa de tempo restante (ETA).

---

## 📚 Documentação Técnica Adicional

Para detalhes arquiteturais e registro de evolução do código, consulte a pasta **`docs/`**:

- 📋 [Planejamento do Projeto](docs/01-planejamento.md) — Objetivos, levantamento de volume e requisitos.
- 🏗️ [Arquitetura & Engenharia](docs/02-arquitetura.md) — Pipeline de renderização em Canvas, ciclo de vida da memória RAM e correção EXIF.
- 📝 [Histórico de Mudanças (Changelog)](docs/historico-mudancas.md) — Registro detalhado de versões e alterações realizadas.
