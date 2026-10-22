# Publicar o Ofertar

O Ofertar é um site estático: `pnpm build` gera a pasta `dist/` com `index.html` (autocontido), manifesto, ícones e service worker. Qualquer hospedagem de arquivos estáticos serve.

## Vercel (endereço oficial)

O projeto `ofertar` na Vercel está ligado a este repositório. Cada envio para a branch `main` gera uma nova publicação em https://ofertar.vercel.app.

Configuração usada:

| Item | Valor |
|---|---|
| Framework | Vite |
| Comando de instalação | `pnpm install` |
| Comando de build | `pnpm build` |
| Pasta de saída | `dist` |

## GitHub Pages (alternativa)

O workflow [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) publica no GitHub Pages a cada envio para `main`. Para ativar: *Settings → Pages → Source: GitHub Actions*.

## Instância própria da instituição

Copie o conteúdo de `dist/` para qualquer servidor web (Apache, Nginx, hospedagem da universidade). Use HTTPS para que o app possa ser instalado e funcionar offline.

## Arquivo único, sem servidor

[`app/index.html`](../app/index.html) é o mesmo app num arquivo só. Pode ser distribuído por e-mail ou pasta compartilhada e aberto com duplo clique. Nesse modo o app não se atualiza sozinho e não aparece a opção de instalar.

## Nova versão

1. Atualize `version` em `package.json`, `CITATION.cff` e `.zenodo.json`, e registre as mudanças em `CHANGELOG.md`.
2. `pnpm build` e copie `dist/index.html` para `app/index.html`.
3. Envie para `main` e crie uma *release* no GitHub (ex.: `v1.1.0`). Com a integração do Zenodo ativa, cada release gera um novo DOI de versão.

## Zenodo

1. Em https://zenodo.org, entre com a conta do GitHub.
2. Em *GitHub* (menu da conta), ative o repositório `baratadiego/ofertar`. O repositório precisa ser público.
3. Crie uma *release* no GitHub. O Zenodo arquiva o código e atribui um DOI, usando os metadados de [`.zenodo.json`](../.zenodo.json).
4. Coloque o selo do DOI no README.
