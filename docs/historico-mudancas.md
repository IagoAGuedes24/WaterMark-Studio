# Histórico de Mudanças (Changelog)

Todas as grandes alterações, correções e novas funcionalidades adicionadas ao projeto são documentadas aqui para manter o `README.md` focado no uso diário.

---

### [Versão 1.1.1] - 2026-09-26
#### Adicionado
- **Rodapé Profissional com Créditos:** Seção inferior elegante com os créditos de idealização (*Iago Albuquerque*) e atalhos diretos para contato (WhatsApp e E-mail), com alinhamento responsivo.
- **Cache Busting:** Inclusão de parâmetros de versão nos links do CSS e JS (`?v=1.1.0`), forçando os navegadores dos visitantes a baixarem a versão mais recente sem retenção de cache antigo.
- **Launcher Nativo Linux/WSL (`iniciar_local.sh`):** Script em bash com permissões executáveis (`chmod +x`) para rodar o servidor local nativamente no terminal Ubuntu.
- **CI/CD no GitHub Pages:** Homologação do pipeline automatizado de Continuous Deployment no repositório oficial `watermark-studio`.

---

### [Versão 1.1.0] - 2026-09-26
#### Adicionado
- **Pasta `docs/`:** Criação da documentação modular com planejamento, arquitetura técnica e changelog.
- **Limite inteligente de amostras na prévia:** Ao carregar pastas volumosas (1.000 a 2.000 fotos), o carrossel de prévia seleciona as **primeiras 10 fotos** para testes rápidos, garantindo fluidez e zero sobrecarga de memória.
- **Fallback para seletor de arquivos:** Suporte a `<input type="file" webkitdirectory>` para compatibilidade caso a *File System Access API* esteja restrita.
- **Launcher Windows (`iniciar_local.bat`):** Script de duplo clique para iniciar o ambiente local no Windows.

#### Corrigido
- **Bloqueio de CORS em protocolo `file:///`:** O JavaScript foi empacotado de forma universal e autocontida, garantindo execução mesmo se o arquivo for aberto sem servidor.
- **Disparo nativo de seleção de logo:** A área da logo foi associada a um elemento `<label>`, permitindo a abertura do seletor de arquivos de forma imediata.

---

### [Versão 1.0.0] - 2026-09-26
#### Adicionado
- Versão inicial do Watermark Studio.
- Interface em Dark Mode com Glassmorphism.
- Grade de 9 posições para a marca d'água.
- Sliders de tamanho proporcional, margem, opacidade e qualidade JPEG.
- Motor de marca d'água com rotação EXIF e suporte a lotes volumosos.
- Barra de progresso com contador, velocidade média (fotos/s) e estimativa de tempo restante (ETA).
- Modal de conclusão com estatísticas do lote.
