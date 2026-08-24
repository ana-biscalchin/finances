# PostgreSQL local para desenvolvimento

## Objetivo

Remover a dependência do Neon no desenvolvimento cotidiano sem divergir do PostgreSQL usado nos ambientes hospedados.

## Requisitos

- **LOCAL-DB-01:** QUANDO `pnpm dev` for executado ENTÃO o projeto DEVE subir um PostgreSQL local isolado antes da API.
- **LOCAL-DB-02:** QUANDO outros projetos usarem as portas PostgreSQL comuns ENTÃO este projeto DEVE usar `127.0.0.1:55432` sem interferir neles.
- **LOCAL-DB-03:** QUANDO o ambiente local iniciar ENTÃO migrations e seed DEVEM executar contra o banco local, nunca contra Neon.
- **LOCAL-DB-04:** QUANDO o processo do app encerrar ENTÃO os dados locais DEVEM permanecer em volume Docker.
- **LOCAL-DB-05:** Staging e produção DEVEM continuar usando seus projetos Neon separados.
- **LOCAL-DB-06:** QUANDO o seed local executar ENTÃO ele DEVE criar o usuário de desenvolvimento com contas, cartões, meios de pagamento, categorias e subcategorias utilizáveis.
