# nvr-bkp-manager

## What This Is

Uma aplicacao web para gerenciamento centralizado de backups de videos de seguranca armazenados em servidores remotos (Storage Boxes). A plataforma permite que usuarios visualizem arquivos .dav diretamente no navegador (via transcodificacao FFmpeg em tempo real), facam upload, download e deletem gravacoes atraves de uma interface segura com controle de acesso — eliminando a necessidade de clientes FTP ou softwares proprietarios de DVR.

## Core Value

Centralizar, simplificar e democratizar o acesso ao gerenciamento de backups de videos de seguranca — tornando formatos proprietarios como .dav reproduziveis em qualquer navegador, sem conhecimento tecnico.

## Current State

| Attribute | Value |
|-----------|-------|
| Type | Application |
| Version | 0.0.1 |
| Status | In Progress |
| Last Updated | 2026-04-02 |

## Requirements

### Core Features

- Configurar Storage: inserir e salvar dados de conexao do servidor remoto (protocolo, host, porta, usuario, senha, diretorio)
- Gerenciar Arquivos: navegar, fazer download, upload e deletar gravacoes no Storage Box remoto
- Assistir Videos: reproduzir .dav e outros formatos diretamente no navegador via transcodificacao FFmpeg em tempo real
- Autenticacao e Acesso: login seguro com niveis de permissao (admin/viewer) para proteger acesso as gravacoes

### Validated (Shipped)
- Project scaffolding: monorepo, Docker Compose, dev environment (Phase 1)
- Storage connection and file listing: SFTP service, REST API, file browser UI (Phase 2)
- Video streaming: .dav remux via FFmpeg, .mp4 direct proxy, browser player (Phase 3)
- File operations: download, upload, delete via web interface (Phase 4)
- Authentication: JWT auth, role-based access, SQLite users, login page (Phase 5)
- Audit logging and production deploy via Dokploy (Phase 6)
- Enhanced filtering: multi-channel chips, time-of-day range, file size range, grouped layout (Phase 7)
- Selection and bulk operations: multi-select, bulk delete, bulk download zip (Phase 8)

### Active (In Progress)
None.

### Planned (Next)
- To be defined after v0.2 milestone
- Deploy plug-and-play via Docker Compose + Dokploy

### Out of Scope
- Integracao com APIs de cloud (AWS S3, Google Cloud, etc.)
- Gravacao direta de cameras (o sistema gerencia backups, nao faz captura)

## Constraints

### Technical Constraints
- FFmpeg transcoding em tempo real e CPU/memoria intensivo — VPS precisa ser dimensionado para multiplos streams simultaneos
- Latencia de rede entre a aplicacao e o Storage Box remoto afeta velocidade de streaming/download
- Credenciais do Storage Box devem ser criptografadas no banco (descriptografadas apenas no momento da conexao)
- Comunicacao com Storage via protocolos padrao (FTP, SFTP, FTPS ou WebDAV)

### Business Constraints
- Sem cronograma rigido — abordagem iterativa (MVP primeiro, depois iteracoes)
- Conformidade LGPD/GDPR: nenhuma rota ou arquivo acessivel sem autenticacao valida
- Logs de auditoria obrigatorios (quem fez o que, quando)

## Key Decisions

| Decision | Rationale | Date | Status |
|----------|-----------|------|--------|
| FFmpeg para transcodificacao .dav | Unico caminho viavel para converter formato proprietario para streaming web | 2026-04-02 | Active |
| Docker Compose para orquestracao | Permite deploy plug-and-play via Dokploy, todos os servicos integrados | 2026-04-02 | Active |
| Metadados de arquivos em runtime | Arquivos ficam no Storage remoto, sem duplicacao no banco local | 2026-04-02 | Active |
| Credenciais de storage criptografadas | Seguranca obrigatoria — descriptografia apenas no momento da conexao | 2026-04-02 | Active |

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Transcoding resiliente | .dav streaming sem crash por OOM/CPU | - | Not started |
| Interoperabilidade Storage | CRUD funcional com oscilacoes de rede | - | Not started |
| Seguranca validada | Zero rotas acessiveis sem autenticacao | - | Not started |
| Deploy plug-and-play | docker-compose up via Dokploy sem config manual | - | Not started |
| Independencia do usuario | Todas as tarefas sem FTP client ou software DVR | - | Not started |

## Tech Stack / Tools

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React (ou Next.js) | Interface moderna e navegacao fluida |
| Backend | Node.js ou Python (FastAPI) | Facilidade de integracao com FFmpeg |
| Transcoding | FFmpeg | Conversao .dav para formato web em tempo real |
| Database | SQLite ou PostgreSQL | SQLite para portabilidade, PostgreSQL para escala |
| Auth | JWT ou Session-based | Senhas com bcrypt/Argon2 |
| Deploy | Docker Compose + Dokploy | Orquestracao completa em VPS |
| Storage Protocol | FTP/SFTP/FTPS/WebDAV | Comunicacao direta com Storage Box |

---
*Created: 2026-04-02*
