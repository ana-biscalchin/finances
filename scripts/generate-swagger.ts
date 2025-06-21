import swaggerJSDoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';

// Define uma interface básica para a especificação do Swagger para ajudar na checagem de tipos
interface SwaggerSpec {
  paths: Record<string, unknown>;
  [key: string]: unknown;
}

// Este script deve ser executado a partir da raiz do projeto
const swaggerOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Finances API',
      version: '1.0.0',
      description: 'API para gerenciamento financeiro pessoal, com controle de contas, transações e categorias.',
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1', // Porta fixa para a geração
        description: 'Servidor de Desenvolvimento'
      },
    ],
  },
  // Caminho para os arquivos que contêm as anotações da API
  apis: ['./src/routes/**/*.ts', './src/domains/**/*.ts'],
};

try {
  console.log('Gerando especificação Swagger...');
  const swaggerSpec = swaggerJSDoc(swaggerOptions) as SwaggerSpec;
  const swaggerJsonPath = path.resolve(process.cwd(), 'docs/swagger.json');
  const apiPaths = swaggerOptions.apis || [];

  // Verifica se o swaggerSpec foi gerado com algum path
  if (!swaggerSpec.paths || Object.keys(swaggerSpec.paths).length === 0) {
      console.warn(`
Atenção: A especificação Swagger foi gerada, mas está vazia.
Isto geralmente acontece por alguns motivos:
1. Os caminhos em 'apis' no script de geração não estão corretos.
   Verifique os padrões: ${apiPaths.join(', ')}
2. Não há comentários de documentação JSDoc (@swagger) nos arquivos correspondentes.
3. Há um erro de sintaxe YAML nos comentários JSDoc que impede o parser de funcionar.

Verifique seus arquivos de rotas e tente novamente.
      `);
  } else {
    console.log(`Foram encontradas rotas para os seguintes paths: ${Object.keys(swaggerSpec.paths).join(', ')}`);
  }

  fs.writeFileSync(swaggerJsonPath, JSON.stringify(swaggerSpec, null, 2));

  console.log(`Especificação Swagger gerada com sucesso em ${swaggerJsonPath}`);
} catch (error) {
  console.error('Erro ao gerar a especificação Swagger:', error);
  process.exit(1);
} 