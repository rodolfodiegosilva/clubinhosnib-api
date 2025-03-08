import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

// Carregar o .env
dotenv.config();

// LOG: Verificar se as variáveis de ambiente estão carregando corretamente
console.log('AWS_REGION:', process.env.AWS_REGION);
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID);
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '******' : 'NOT SET');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function testS3Connection() {
  try {
    console.log('🔍 Testando conexão com S3...');
    const buckets = await s3.send(new ListBucketsCommand({}));
    console.log('Buckets disponíveis:', buckets.Buckets);
  } catch (error) {
    console.error('❌ Erro ao conectar ao S3:', error);
  }
}

testS3Connection();
