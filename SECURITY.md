# Segurança e privacidade

## Onde ficam os dados

O Ofertar não tem servidor nem banco de dados. Tudo o que você cadastra (docentes, matrizes, ofertas) fica:

- no armazenamento do próprio navegador, no computador em que você usa o app; e
- no arquivo `.json` que você salvar.

Nada é enviado para a Vercel, para o GitHub ou para os autores. O site publicado só entrega o programa. Por isso cada pessoa que abre o endereço vê o app vazio, e duas coordenações nunca veem os dados uma da outra.

Únicas conexões externas: as fontes tipográficas do Google Fonts. O app funciona sem elas.

## Cuidados recomendados

- Guarde o `.json` numa pasta institucional com acesso restrito à coordenação. Ele contém nomes de docentes e a distribuição de carga horária.
- Em computador compartilhado, use **Configurações → Fechar projeto e limpar este navegador** ao terminar (salve o `.json` antes).
- Abra apenas arquivos `.json` de origem conhecida. O app confere a estrutura do arquivo antes de carregá-lo.

## Relatar um problema

Encontrou uma falha de segurança? Não abra uma *issue* pública. Use **Security → Report a vulnerability** neste repositório no GitHub, ou escreva para o autor pelo perfil do GitHub. A resposta vem em até 15 dias.
